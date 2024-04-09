const {Airtable} = require("../kit/foundations/airtable");

module.exports = {
    operation: {
        perform: async (z, bundle) => {
            const airtable = new Airtable(
                {
                    apiKey: bundle.inputData.airtablePersonalAccessToken
                }
            )

            return await airtable.bases()
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
        ],
        sample: {
            id: 'appG0GLm25jEOYTMv',
            name: 'Microsoft To Do - Notion',
            permissionLevel: 'create',
        },
        outputFields: [{key: 'id'}, {key: 'name'}, {key: 'permissionLevel'}],
    },
    display: {
        description: 'Triggers when a new Airtable base is created.',
        hidden: true,
        label: 'List Airtable Bases',
    },
    key: 'list_airtable_bases',
    noun: 'Airtable Base',
};
