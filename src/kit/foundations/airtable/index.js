const AirtableClient = require('airtable')
const {asyncIter2Array, wrapAsync} = require("../../utils/async");
const {Bulk} = require("../bulk");
const _ = require("lodash")

class Table {
    constructor(id, _baseId, _client, _cache) {
        this.id = id
        this._baseId = _baseId
        this._client = _client
        this._cache = _cache
        this._cacheIdPrefix = `${this._baseId}::::${this.id}::::`
    }

    getAll = async (query=[], returnFirst = false) => {
        let records

        if (!Array.isArray(query) && (typeof query === 'object')) {
            records = await this._client.base(this._baseId).table(this.id).select(
                {
                    filterByFormula: Table._convertToFormula(query),
                    ...(returnFirst ? {maxRecords: 1} : {})
                }
            ).all()

            const queryAsEntries = _.zip(
                Table._convertToIds(query, this._cacheIdPrefix),
                Table._convertToObjects(query)
            )

            for (const [id, fields] of queryAsEntries) {
                for (
                    const record of _.filter(
                    records,
                    {
                        fields: fields
                    }
                )
                    ) {
                    this._cache.set(id, record)
                    this._cache.set([this._cacheIdPrefix, record?.id].join(":ID:"), record)
                }
            }

        } else {
            records = await asyncIter2Array(
                query,
                async (recordId) => {
                    return await this._client.base(this._baseId).table(this.id).find(recordId)
                }
            )

            for (const record of records) {
                this._cache.set([this._cacheIdPrefix, record?.id].join(":ID:"), record)
            }
        }

        return returnFirst ? records.at(0) : records
    }

    getFirst = async (query) =>
        !Array.isArray(query) && (typeof query === 'object') ?
            (
                await this._client.base(this._baseId).table(this.id).select(
                    {
                        filterByFormula: Table._convertToFormula(query),
                        maxRecords: 1
                    }
                ).firstPage()
            ).at(0) : null

    getOneFromCache = (query) => {
        if (typeof query === 'string') {
            return this._cache.get([this._cacheIdPrefix, query].join(":ID:"))
        }

        return this._cache.get(Table._convertToIds(query, this._cacheIdPrefix).at(0))
    }

    record = (recordId) =>
        wrapAsync(
            this._client.base(this._baseId).table(this.id).find(recordId)
        )

    bulkEdit = async (data) =>
        (
            await asyncIter2Array(
                _.chunk(data, Table.ITEMS_LIMIT_PER_REQUEST),
                async (data) => {
                    return await this._client.base(this._baseId).table(this.id).update(data)
                }
            )
        ).flat()

    bulkEditByQuery = async (data) =>
        await this.bulkEdit(
            (
                await asyncIter2Array(
                    Object.entries(Table._groupByQuery(data)),
                    async ([field, data]) => {

                        const bulk = new Bulk(
                            {
                                name: "getRecordIds",
                                processor: async (data) =>
                                    await this.getAll(
                                        {
                                            [field]: data.map(
                                                item => item[field]
                                            )
                                        }
                                    ),
                                connection: {
                                    keys: [`${field}`, `fields.${field}`],
                                    type: "flat"
                                }
                            }
                        )

                        bulk.actions.getRecordIds.addAll(data)

                        await bulk.act()

                        return bulk.actions.getRecordIds.value
                    }
                )
            ).flat().map(
                ([_, {fields}, {id}]) => ({id, fields})
            )
        )

    bulkDeleteByQuery = async (query) =>
        await this.bulkDelete(
            (
                await asyncIter2Array(
                    Object.entries(query),
                    async ([field, values]) => {
                        return await this.getAll(
                            {
                                [field]: values
                            }
                        )
                    }
                )
            ).flat().map(
                ({id}) => id
            )
        )

    bulkDelete = async (recordIds) =>
        (
            await asyncIter2Array(
                _.chunk(recordIds, Table.ITEMS_LIMIT_PER_REQUEST),
                async (recordIds) => {
                    return await this._client.base(this._baseId).table(this.id).destroy(recordIds)
                }
            )
        ).flat()

    bulkCreate = async (data) =>
        (
            await asyncIter2Array(
                _.chunk(data, Table.ITEMS_LIMIT_PER_REQUEST),
                async (data) => {
                    return await this._client.base(this._baseId).table(this.id).create(
                        data.map(
                            obj => (
                                {
                                    fields: obj
                                }
                            )
                        )
                    )
                }
            )
        ).flat()

    bulkCreateByCells = async (cells, mapping) =>
        (
            await asyncIter2Array(
                _.chunk(cells, Table.ITEMS_LIMIT_PER_REQUEST),
                async (cells) => {
                    return await this._client.base(this._baseId).table(this.id).create(
                        cells.map(
                            cell => (
                                {
                                    fields: Object.fromEntries(
                                        mapping.map(
                                            (field, i) => [[field], cell[i]]
                                        )
                                    )
                                }
                            )
                        )
                    )
                }
            )
        ).flat()

    bulkEditByCells = async (cells, mapping) =>
        (
            await asyncIter2Array(
                _.chunk(cells, Table.ITEMS_LIMIT_PER_REQUEST),
                async (cells) => {
                    return await this._client.base(this._baseId).table(this.id).update(
                        cells.map(
                            cell => (
                                {
                                    id: cell[0],
                                    fields: Object.fromEntries(
                                        mapping.map(
                                            (field, i) => [[field], cell[i+1]]
                                        )
                                    )
                                }
                            )
                        )
                    )
                }
            )
        ).flat()

    static _groupByQuery = data => data.reduce((acc, obj) => (acc[Object.keys(obj.query)[0]] = [...(acc[Object.keys(obj.query)[0]] || []), {
        [Object.keys(obj.query)[0]]: Object.values(obj.query)[0],
        fields: obj.fields
    }], acc), {});

    static ITEMS_LIMIT_PER_REQUEST = 10

    static _convertToObjects = (query) => {
        const buildConditions = (obj, keys = []) => {
            let conditions = [];
            for (const key in obj) {
                const currentKeys = [...keys, key];
                if (Array.isArray(obj[key][0])) {
                    // Handling leaf nodes with arrays of arrays
                    obj[key].forEach(arr => {
                        let condition = {};
                        currentKeys.forEach((k, index) => {
                            condition[k] = arr[index];
                        });
                        conditions.push(condition);
                    });
                } else if (Array.isArray(obj[key])) {
                    // Handling leaf nodes with arrays
                    obj[key].forEach((value, index) => {
                        let condition = {};
                        condition[currentKeys[currentKeys.length - 1]] = value;
                        conditions.push(condition);
                    });
                } else if (typeof obj[key] === 'object') {
                    // Recursively handle nested objects
                    conditions.push(...buildConditions(obj[key], currentKeys));
                } else {
                    // Handling leaf nodes with single values
                    let condition = {};
                    condition[currentKeys[currentKeys.length - 1]] = obj[key];
                    conditions.push(condition);
                }
            }
            return conditions;
        };

        return buildConditions(query);
    };

    static _convertToFormula = query => {
        function buildConditions(obj, keys = []) {
            let conditions = [];
            for (const key in obj) {
                const currentKeys = [...keys, key];
                if (Array.isArray(obj[key][0])) {
                    // Handling leaf nodes with arrays of arrays
                    let andConditions = [];
                    obj[key].forEach(arr => {
                        let innerConditions = [];
                        arr.forEach((value, index) => {
                            innerConditions.push(`{${currentKeys[index]}}='${value}'`);
                        });
                        andConditions.push(`AND(${innerConditions.join(',')})`);
                    });
                    conditions.push(andConditions.join(','));
                } else if (Array.isArray(obj[key])) {
                    // Handling leaf nodes with arrays
                    obj[key].forEach(value => {
                        conditions.push(`{${key}}='${value}'`);
                    });
                } else if (typeof obj[key] === 'object') {
                    // Recursively handle nested objects
                    conditions.push(buildConditions(obj[key], currentKeys).join(','));
                } else {
                    // Handling leaf nodes with single values
                    conditions.push(`{${currentKeys.join('.')}}='${obj[key]}'`);
                }
            }
            return conditions;
        }

        const topLevelConditions = buildConditions(query);
        return `OR(${topLevelConditions.join(',')})`;
    }

    static _convertToIds = (query, prefix = '') => {
        const buildConditions = (obj, keys = []) => {
            let conditions = [];
            for (const key in obj) {
                const currentKeys = [...keys, key];
                if (Array.isArray(obj[key][0])) {
                    // Handling leaf nodes with arrays of arrays
                    obj[key].forEach(arr => {
                        let condition = currentKeys.map((k, index) => `${k}::::${arr[index]}`).join('::::');
                        conditions.push(prefix + condition);
                    });
                } else if (Array.isArray(obj[key])) {
                    // Handling leaf nodes with arrays
                    obj[key].forEach(value => {
                        currentKeys.forEach(k => {
                            let condition = `${k}::::${value}`;
                            conditions.push(prefix + condition);
                        });
                    });
                } else if (typeof obj[key] === 'object') {
                    // Recursively handle nested objects
                    conditions.push(...buildConditions(obj[key], currentKeys));
                } else {
                    // Handling leaf nodes with single values
                    let condition = `${currentKeys.join('::::')}::::${obj[key]}`;
                    conditions.push(prefix + condition);
                }
            }
            return conditions;
        };

        return buildConditions(query);
    };

    static _fieldsFromQuery = query => Object.keys(query).flatMap(key => typeof query[key] === 'object' && query[key] !== null ? [key, ...Table._fieldsFromQuery(query[key])] : key);
}

class Base {
    constructor(id, _client, _cache) {
        this.id = id
        this._client = _client
        this._cache = _cache
    }

    table = (id) => new Table(id, this.id, this._client, this._cache)

    tables = async () => {
        const response = await fetch(
            `https://api.airtable.com/v0/meta/bases/${this.id}/tables`,
            {
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${this._client._apiKey}`
                }
            }
        );

        const {tables} = await response.json();

        return tables;
    }
}

class Airtable {
    constructor(config) {
        this._client = new AirtableClient(config)
        this._cache = new Map()
    }

    bases = async () => {
        const response = await fetch('https://api.airtable.com/v0/meta/bases', {
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${this._client._apiKey}`,
            }
        });

        const {bases} = await response.json();

        return bases;
    }

    base = (id) => new Base(id, this._client, this._cache)
}

exports.Airtable = Airtable