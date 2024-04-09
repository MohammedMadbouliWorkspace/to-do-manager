const {asyncIter2Array} = require("../../utils/async");
const _ = require("lodash");

class Bulk {
    constructor(config) {
        this._config = config
        this.actions = Bulk._generateActions(this._config)
        this._actionsOrder = Bulk._generateActionsOrder(this._config)
    }

    static _generateActions = ({name, processor, connection, next}, actions = {}) => (
        {
            ...actions,
            [name]: new Action(
                name,
                processor,
                connection
            ),
            ...(next ? Bulk._generateActions(next, actions) : {})
        }
    )

    static _generateActionsOrder = ({name, processor, connection, next}, actionsOrder = []) => [
        ...actionsOrder,
        name,
        ...(next ? Bulk._generateActionsOrder(next, actionsOrder) : [])
    ]

    act = async () =>
        await asyncIter2Array(
            this._actionsOrder,
            async (name, i) => {

                const { _inPool: currentInPool = [] } = this.actions[name] || {}
                const { _outPool: previousOutPool = [] } = this.actions[this._actionsOrder[i-1]] || {}

                this.actions[name].pools = [
                    [
                        ...Object.values(currentInPool),
                        ...Object.values(previousOutPool)
                    ]
                ]

                return await this.actions[name]?.run()
            }
        )
}

class Action {
    constructor(name, processor, connection = {keys: [null, null], type: "object"}) {
        this.name = name;
        this.processor = processor;
        this.connection = connection;
        this.pools = []
    }

    run = async () => {
        this._outPool = Action.connect(Object.values(this._inPool), Object.values(await this.processor(this._inPool)), ...this.connection?.keys, this.connection?.type)
        return this._outPool
    }

    set pools([inPool = this._inPool || [], outPool = this._outPool || []]) {
        this._inPool = inPool
        this._outPool = outPool
    }

    get value() {
        return this._outPool
    }

    add = (item) => {
        if (typeof this._inPool === 'object') {
            if (Array.isArray(this._inPool)) {
                this._inPool.push(item)
            } else {
                if (typeof item === 'object') {
                    this._inPool = {
                        ...this._inPool,
                        ...item
                    }
                }
            }
        }
    }

    addAll = (items) => {
        for (const item of items) {
            this.add(item)
        }
    }

    append = (item) => {
        this._outPool.push(item)
    }

    static connect = (arr1, arr2, iteratee1=x=>x, iteratee2=x=>x, option="flat") => {
        const isFunction = (func) => typeof func === 'function';

        iteratee1 = iteratee1 || (x=>x)
        iteratee2 = iteratee2 || (x=>x)

        switch (option) {
            case "object":
                const output1 = {};
                arr1.forEach(item => {
                    const key = isFunction(iteratee1) ? iteratee1(item) : _.get(item, iteratee1);
                    const connections = arr2.filter(secondItem => {
                        const value = isFunction(iteratee2) ? iteratee2(secondItem) : _.get(secondItem, iteratee2);
                        return value === key;
                    });
                    if (connections.length > 0) output1[key] = [item, connections];
                });
                return output1;

            case "entries":
                return Object.entries(Action.connect(arr1, arr2, iteratee1, iteratee2, "object"));

            case "flat":
                const output3 = [];
                arr2.forEach(secondItem => {
                    const valueFromSecondArray = isFunction(iteratee2) ? iteratee2(secondItem) : _.get(secondItem, iteratee2);
                    const correspondingItemsFromFirstArray = arr1.filter(firstItem => {
                        const value = isFunction(iteratee1) ? iteratee1(firstItem) : _.get(firstItem, iteratee1);
                        return value === valueFromSecondArray;
                    });
                    if (correspondingItemsFromFirstArray.length > 0) {
                        correspondingItemsFromFirstArray.forEach(firstItem => output3.push([valueFromSecondArray, firstItem, secondItem]));
                    }
                });
                return output3;

            default:
                throw new Error('Invalid option.');
        }
    };
}

exports.Bulk = Bulk
exports.Action = Action