const {Airtable} = require("../kit/foundations/airtable");

module.exports = {
    operation: {
        perform: async (z, bundle) => {
            const airtable = new Airtable(
                {
                    apiKey: bundle.inputData.airtablePersonalAccessToken
                }
            )

            return await airtable.base(bundle.inputData.airtableBaseId).tables()
        },
        inputFields: [
            {
                key: 'airtablePersonalAccessToken',
                type: 'string',
                label: 'Airtable Personal Access Token',
                required: true,
                list: false,
                altersDynamicFields: false,
            },
            {
                key: 'airtableBaseId',
                type: 'string',
                label: 'Airtable Base',
                required: true,
                list: false,
                altersDynamicFields: false,
            },
        ],
        sample: {
            id: 'tblzzJ17gXI1sVuKV',
            name: 'taskIds',
            primaryFieldId: 'fldaOA9xQ8MEEsAHr',
            fields: [
                {type: 'singleLineText', id: 'fldaOA9xQ8MEEsAHr', name: 'id'},
                {
                    type: 'singleLineText',
                    id: 'fldPCn6pulWced7bu',
                    name: 'microsoftId',
                },
            ],
            views: [{id: 'viwFJ3WeOITa0wgwX', name: 'Grid view', type: 'grid'}],
        },
        outputFields: [
            {key: 'id'},
            {key: 'name'},
            {key: 'primaryFieldId'},
            {key: 'fields[]type'},
            {key: 'fields[]id'},
            {key: 'fields[]name'},
            {key: 'views[]id'},
            {key: 'views[]name'},
            {key: 'views[]type'},
        ],
    },
    display: {
        description: 'Triggers when a new Airtable table is created.',
        hidden: true,
        label: 'List Airtable Tables',
    },
    key: 'list_airtable_tables',
    noun: 'Airtable Table',
};
