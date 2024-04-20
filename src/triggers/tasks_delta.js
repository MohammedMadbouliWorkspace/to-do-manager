const {TodoManager} = require("../kit/imps/todo-manager");
const {v4: uuidv4} = require("uuid");
const _ = require("lodash");

module.exports = {
    operation: {
        perform: async (z, bundle) => {
            const manager = new TodoManager(
                {
                    z: z,
                    msAccessToken: bundle.authData.access_token,
                    msTodoListId: bundle.inputData.listId,
                    airtableConfig: {
                        apiKey: bundle.inputData.airtablePersonalAccessToken,
                        baseId: bundle.inputData.airtableBaseId,
                        dataTableId: bundle.inputData.airtableDataTableId,
                        idsTableId: bundle.inputData.airtableIdsTableId,
                        syncCheckpointsTableId: bundle.inputData.airtableSyncCheckpointsTableId,
                    },
                    timeZone: bundle.inputData.timeZone
                }
            )

            await manager.validateAccess()

            const data = await manager.tasksDelta.get()

            return !_.every(data, (value) => _.isArray(value) && _.isEmpty(value)) ? [{
                id: uuidv4(),
                data: JSON.stringify(data)
            }] : []
        },
        inputFields: [
            {
                key: 'airtablePersonalAccessToken',
                label: 'Airtable Personal Access Token',
                type: 'string',
                required: true,
                list: false,
                altersDynamicFields: false,
            },
            {
                key: 'airtableBaseId',
                label: 'Airtable Base Id',
                type: 'string',
                dynamic: 'list_airtable_bases.id.name',
                required: true,
                list: false,
                altersDynamicFields: false,
            },
            {
                key: 'airtableIdsTableId',
                label: 'Airtable Ids Table Id',
                type: 'string',
                dynamic: 'list_airtable_tables.id.name',
                required: true,
                list: false,
                altersDynamicFields: false,
            },
            {
                key: 'airtableDataTableId',
                label: 'Airtable Data Table Id',
                type: 'string',
                dynamic: 'list_airtable_tables.id.name',
                required: true,
                list: false,
                altersDynamicFields: false,
            },
            {
                key: 'airtableSyncCheckpointsTableId',
                label: 'Airtable Sync Checkpoints Table Id',
                type: 'string',
                dynamic: 'list_airtable_tables.id.name',
                required: true,
                list: false,
                altersDynamicFields: false,
            },
            {
                key: 'listId',
                label: 'List',
                type: 'string',
                dynamic: 'list_tasklists.id.displayName',
                required: true,
                list: false,
                altersDynamicFields: false,
            },
            {
                key: 'timeZone',
                label: 'Time Zone',
                type: 'string',
                choices: Intl.supportedValuesOf('timeZone'),
                required: false,
                list: false,
                altersDynamicFields: false,
            },
        ],
        sample: {
            id: '6f4525bf-647a-4a05-bdde-ae9307aef063',
            data: '{"toEdit":[{"ids":{"notionId":"c0af21eb-92d5-4025-bceb-bc43a3081672","microsoftId":"AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByRMI9wAAAA=","airtableId":"recqDhUboUkgWqWxO"},"data":{"emoji":"🥞","title":"وجبة صباحية"},"syncData":{"microsoftData":"{\\"@odata.etag\\":\\"W/\\\\\\"8NnOotMXhUieb2t2gkvYawAHJWX7gQ==\\\\\\"\\",\\"importance\\":\\"normal\\",\\"isReminderOn\\":false,\\"status\\":\\"notStarted\\",\\"title\\":\\"🥞 وجبة صباحية\\",\\"createdDateTime\\":\\"2024-04-16T15:28:36.555862Z\\",\\"lastModifiedDateTime\\":\\"2024-04-17T23:52:03.5665669Z\\",\\"hasAttachments\\":false,\\"categories\\":[],\\"id\\":\\"AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByRMI9wAAAA=\\",\\"body\\":{\\"content\\":\\"\\",\\"contentType\\":\\"text\\"},\\"dueDateTime\\":{\\"dateTime\\":\\"2024-04-15T22:00:00.0000000\\",\\"timeZone\\":\\"UTC\\"},\\"startDateTime\\":{\\"dateTime\\":\\"2024-04-15T22:00:00.0000000\\",\\"timeZone\\":\\"UTC\\"},\\"reminderDateTime\\":{\\"dateTime\\":\\"2024-04-16T15:27:00.0000000\\",\\"timeZone\\":\\"UTC\\"}}"}}],"toCreate":[{"ids":{"microsoftId":"AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByVI9nwAAAA="},"data":{"emoji":"","title":"أول خطوة","checked":false},"syncData":{"microsoftData":"{\\"@odata.etag\\":\\"W/\\\\\\"8NnOotMXhUieb2t2gkvYawAHJWX7iQ==\\\\\\"\\",\\"importance\\":\\"normal\\",\\"isReminderOn\\":false,\\"status\\":\\"notStarted\\",\\"title\\":\\"أول خطوة\\",\\"createdDateTime\\":\\"2024-04-17T23:52:04.5235219Z\\",\\"lastModifiedDateTime\\":\\"2024-04-17T23:52:04.5632948Z\\",\\"hasAttachments\\":false,\\"categories\\":[],\\"id\\":\\"AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByVI9nwAAAA=\\",\\"body\\":{\\"content\\":\\"\\",\\"contentType\\":\\"text\\"}}"}}],"toDelete":[{"ids":{"notionId":"8b02a379-a96d-4786-a036-f22882106a13","microsoftId":"AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByRMI9sAAAA=","idsTableAirtableId":"recGsg6WCkAbYJ6wx","airtableId":"rec9jIVlQSiWJ4XnV"}}],"toRefresh":[{"ids":{"notionId":"575ec4ee-8442-408c-8ba4-e059447a0e96","microsoftId":"AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByRMI90AAAA="},"syncData":{"microsoftData":"{\\"@odata.context\\":\\"https://graph.microsoft.com/v1.0/$metadata#users(\'memm9999%40gmail.com\')/todo/lists(\'AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoALgAAA_5O2q_UDY9Cqvocq3zbHoYBAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAA%3D%3D\')/tasks/$entity\\",\\"@odata.etag\\":\\"W/\\\\\\"8NnOotMXhUieb2t2gkvYawAHJWX7lA==\\\\\\"\\",\\"importance\\":\\"normal\\",\\"isReminderOn\\":false,\\"status\\":\\"completed\\",\\"title\\":\\"🍳 كوكنج\\",\\"createdDateTime\\":\\"2024-04-16T15:28:36.7395878Z\\",\\"lastModifiedDateTime\\":\\"2024-04-18T00:02:08.8488344Z\\",\\"hasAttachments\\":false,\\"categories\\":[],\\"id\\":\\"AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByRMI90AAAA=\\",\\"body\\":{\\"content\\":\\"\\",\\"contentType\\":\\"text\\"},\\"completedDateTime\\":{\\"dateTime\\":\\"2024-04-15T22:00:00.0000000\\",\\"timeZone\\":\\"UTC\\"},\\"dueDateTime\\":{\\"dateTime\\":\\"2024-04-15T22:00:00.0000000\\",\\"timeZone\\":\\"UTC\\"},\\"startDateTime\\":{\\"dateTime\\":\\"2024-04-15T22:00:00.0000000\\",\\"timeZone\\":\\"UTC\\"},\\"reminderDateTime\\":{\\"dateTime\\":\\"2024-04-16T15:27:00.0000000\\",\\"timeZone\\":\\"UTC\\"},\\"checklistItems@odata.context\\":\\"https://graph.microsoft.com/v1.0/$metadata#users(\'memm9999%40gmail.com\')/todo/lists(\'AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoALgAAA_5O2q_UDY9Cqvocq3zbHoYBAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAA%3D%3D\')/tasks(\'AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByRMI90AAAA%3D\')/checklistItems\\",\\"checklistItems\\":[{\\"displayName\\":\\"🍔 عشاء\\",\\"createdDateTime\\":\\"2024-04-16T15:28:37Z\\",\\"isChecked\\":false,\\"id\\":\\"05398264-4c24-4145-a3c4-c7b336023ccb\\"},{\\"displayName\\":\\"🍗 الغدا\\",\\"createdDateTime\\":\\"2024-04-16T15:28:37Z\\",\\"isChecked\\":false,\\"id\\":\\"846a7d22-b904-4da1-a3bf-526e98275714\\"},{\\"displayName\\":\\"🥞 وجبة صباحية\\",\\"createdDateTime\\":\\"2024-04-16T15:28:37Z\\",\\"isChecked\\":false,\\"id\\":\\"1019477b-9579-44ea-ac23-1a2298e33802\\"},{\\"displayName\\":\\"مشروب ملهلب :)\\",\\"createdDateTime\\":\\"2024-04-16T15:45:02Z\\",\\"isChecked\\":false,\\"id\\":\\"40e6a545-df60-4034-86b7-e9193155ceb3\\"}]}"}}]}'
        },
        outputFields: [
            {key: 'id'},
            {key: 'data'}
        ],
    },
    display: {
        description: 'Triggers when there is a tasks delta',
        hidden: false,
        label: 'Tasks Delta',
    },
    key: 'tasks_delta',
    noun: 'Tasks Delta',
};
