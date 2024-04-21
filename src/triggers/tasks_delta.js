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
            data: '{"toEdit":[{"ids":{"notionId":"da1e1268-2f05-46cd-a34c-29fc4c4d3a52","microsoftId":"AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByV844AAAAA=","airtableId":"rec1O7WHV5VVKR95t"},"data":{"emoji":"💻","title":"تصفح الانترنت"},"syncData":{"microsoftData":{"@odata.etag":"W/\\"8NnOotMXhUieb2t2gkvYawAHJZpz6A==\\"","importance":"normal","isReminderOn":false,"status":"notStarted","title":"💻 تصفح الانترنت","createdDateTime":"2024-04-20T19:31:09.9004837Z","lastModifiedDateTime":"2024-04-21T00:30:27.494603Z","hasAttachments":false,"categories":[],"id":"AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByV844AAAAA=","body":{"content":"","contentType":"text"},"dueDateTime":{"dateTime":"2024-04-19T22:00:00.0000000","timeZone":"UTC"},"startDateTime":{"dateTime":"2024-04-19T22:00:00.0000000","timeZone":"UTC"},"reminderDateTime":{"dateTime":"2024-04-20T19:29:00.0000000","timeZone":"UTC"},"checklistItems@odata.context":"https://graph.microsoft.com/v1.0/$metadata#users(\'memm9999%40gmail.com\')/todo/lists(\'AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoALgAAA_5O2q_UDY9Cqvocq3zbHoYBAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAA%3D%3D\')/tasks(\'AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByV844AAAAA%3D\')/checklistItems","checklistItems":[{"displayName":"👨🏻‍💻 عمل","createdDateTime":"2024-04-20T19:31:10Z","checkedDateTime":"2024-04-20T19:40:27Z","isChecked":true,"id":"46d116ab-7177-4aaa-b5c4-ff31b4796abf"},{"displayName":"استراحة 🛋️","createdDateTime":"2024-04-20T19:44:06Z","isChecked":false,"id":"9eacef14-cabd-4537-a691-272731e85561"}]}}},{"ids":{"notionId":"717348cc-834f-4d89-9107-14cefe45f36a","microsoftId":"AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByV8438AAAA=","airtableId":"rech12yllwsGkMYIP"},"data":{"checked":true},"syncData":{"microsoftData":{"@odata.etag":"W/\\"8NnOotMXhUieb2t2gkvYawAHJZpz6g==\\"","importance":"normal","isReminderOn":false,"status":"completed","title":"👨🏻‍💻 عمل","createdDateTime":"2024-04-20T19:31:09.7394423Z","lastModifiedDateTime":"2024-04-21T00:30:27.9860624Z","hasAttachments":false,"categories":[],"id":"AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByV8438AAAA=","body":{"content":"","contentType":"text"},"completedDateTime":{"dateTime":"2024-04-20T00:00:00.0000000","timeZone":"UTC"},"dueDateTime":{"dateTime":"2024-04-19T22:00:00.0000000","timeZone":"UTC"},"startDateTime":{"dateTime":"2024-04-19T22:00:00.0000000","timeZone":"UTC"},"reminderDateTime":{"dateTime":"2024-04-20T19:30:00.0000000","timeZone":"UTC"}}}},{"ids":{"notionId":"717348cc-834f-4d89-9107-14cefe45f36a","microsoftId":"AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByV8438AAAA=","airtableId":"rech12yllwsGkMYIP"},"data":{"emoji":"👨","title":"🏻‍💻 عمل","checked":true},"syncData":{"microsoftData":{"@odata.context":"https://graph.microsoft.com/v1.0/$metadata#users(\'memm9999%40gmail.com\')/todo/lists(\'AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoALgAAA_5O2q_UDY9Cqvocq3zbHoYBAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAA%3D%3D\')/tasks/$entity","@odata.etag":"W/\\"8NnOotMXhUieb2t2gkvYawAHJZp0Bg==\\"","importance":"normal","isReminderOn":false,"status":"completed","title":"👨🏻‍💻 عمل","createdDateTime":"2024-04-20T19:31:09.7394423Z","lastModifiedDateTime":"2024-04-21T00:34:01.6871716Z","hasAttachments":false,"categories":[],"id":"AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByV8438AAAA=","body":{"content":"","contentType":"text"},"completedDateTime":{"dateTime":"2024-04-20T00:00:00.0000000","timeZone":"UTC"},"dueDateTime":{"dateTime":"2024-04-19T22:00:00.0000000","timeZone":"UTC"},"startDateTime":{"dateTime":"2024-04-19T22:00:00.0000000","timeZone":"UTC"},"reminderDateTime":{"dateTime":"2024-04-20T19:30:00.0000000","timeZone":"UTC"}}}}],"toCreate":[{"ids":{"microsoftId":"AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByV844EAAAA="},"data":{"title":"مراجعة قرآن"},"syncData":{"microsoftData":{"@odata.etag":"W/\\"8NnOotMXhUieb2t2gkvYawAHJZpvZw==\\"","importance":"normal","isReminderOn":false,"status":"notStarted","title":"مراجعة قرآن","createdDateTime":"2024-04-20T19:44:27.0968162Z","lastModifiedDateTime":"2024-04-20T19:44:43.1272547Z","hasAttachments":false,"categories":[],"id":"AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByV844EAAAA=","body":{"content":"","contentType":"text"},"checklistItems@odata.context":"https://graph.microsoft.com/v1.0/$metadata#users(\'memm9999%40gmail.com\')/todo/lists(\'AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoALgAAA_5O2q_UDY9Cqvocq3zbHoYBAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAA%3D%3D\')/tasks(\'AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByV844EAAAA%3D\')/checklistItems","checklistItems":[{"displayName":"مراجعة الورد اليومي","createdDateTime":"2024-04-20T19:44:43.0196531Z","isChecked":false,"id":"773250ae-0254-4c8c-8ec7-a567b0822183"}]}}},{"ids":{"microsoftId":"9eacef14-cabd-4537-a691-272731e85561","parentNotionId":"da1e1268-2f05-46cd-a34c-29fc4c4d3a52","parentMicrosoftId":"AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByV844AAAAA="},"data":{"emoji":"🛋","title":"استراحة","start":"2024-04-19T20:00:00.000+00:00","end":"2024-04-19T20:00:00.000+00:00"},"syncData":{"microsoftData":{"@odata.context":"https://graph.microsoft.com/v1.0/$metadata#users(\'memm9999%40gmail.com\')/todo/lists(\'AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoALgAAA_5O2q_UDY9Cqvocq3zbHoYBAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAA%3D%3D\')/tasks/$entity","@odata.etag":"W/\\"8NnOotMXhUieb2t2gkvYawAHJZp0CQ==\\"","importance":"normal","isReminderOn":false,"status":"notStarted","title":"استراحة 🛋️","createdDateTime":"2024-04-21T00:34:02.1385781Z","lastModifiedDateTime":"2024-04-21T00:34:02.1804817Z","hasAttachments":false,"categories":[],"id":"AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByV8444AAAA=","body":{"content":"","contentType":"text"},"dueDateTime":{"dateTime":"2024-04-18T22:00:00.0000000","timeZone":"UTC"},"startDateTime":{"dateTime":"2024-04-18T22:00:00.0000000","timeZone":"UTC"}}}},{"ids":{"microsoftId":"773250ae-0254-4c8c-8ec7-a567b0822183","parentMicrosoftId":"AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByV844EAAAA="},"data":{"title":"مراجعة الورد اليومي"},"syncData":{"microsoftData":{"@odata.context":"https://graph.microsoft.com/v1.0/$metadata#users(\'memm9999%40gmail.com\')/todo/lists(\'AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoALgAAA_5O2q_UDY9Cqvocq3zbHoYBAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAA%3D%3D\')/tasks/$entity","@odata.etag":"W/\\"8NnOotMXhUieb2t2gkvYawAHJZp0Dg==\\"","importance":"normal","isReminderOn":false,"status":"notStarted","title":"مراجعة الورد اليومي","createdDateTime":"2024-04-21T00:34:02.4113809Z","lastModifiedDateTime":"2024-04-21T00:34:02.4545613Z","hasAttachments":false,"categories":[],"id":"AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByV8448AAAA=","body":{"content":"","contentType":"text"},"dueDateTime":{"dateTime":"2024-04-20T22:00:00.0000000","timeZone":"UTC"},"startDateTime":{"dateTime":"2024-04-20T22:00:00.0000000","timeZone":"UTC"}}}}],"toDelete":[],"toRefresh":[{"ids":{"notionId":"da1e1268-2f05-46cd-a34c-29fc4c4d3a52","microsoftId":"AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByV844AAAAA="},"syncData":{"microsoftData":{"@odata.context":"https://graph.microsoft.com/v1.0/$metadata#users(\'memm9999%40gmail.com\')/todo/lists(\'AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoALgAAA_5O2q_UDY9Cqvocq3zbHoYBAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAA%3D%3D\')/tasks/$entity","@odata.etag":"W/\\"8NnOotMXhUieb2t2gkvYawAHJZp0BA==\\"","importance":"normal","isReminderOn":false,"status":"notStarted","title":"💻 تصفح الانترنت","createdDateTime":"2024-04-20T19:31:09.9004837Z","lastModifiedDateTime":"2024-04-21T00:34:01.2116367Z","hasAttachments":false,"categories":[],"id":"AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByV844AAAAA=","body":{"content":"","contentType":"text"},"dueDateTime":{"dateTime":"2024-04-19T22:00:00.0000000","timeZone":"UTC"},"startDateTime":{"dateTime":"2024-04-19T22:00:00.0000000","timeZone":"UTC"},"reminderDateTime":{"dateTime":"2024-04-20T19:29:00.0000000","timeZone":"UTC"},"checklistItems@odata.context":"https://graph.microsoft.com/v1.0/$metadata#users(\'memm9999%40gmail.com\')/todo/lists(\'AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoALgAAA_5O2q_UDY9Cqvocq3zbHoYBAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAA%3D%3D\')/tasks(\'AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsAByV844AAAAA%3D\')/checklistItems","checklistItems":[{"displayName":"👨🏻‍💻 عمل","createdDateTime":"2024-04-20T19:31:10Z","checkedDateTime":"2024-04-20T19:40:27Z","isChecked":true,"id":"46d116ab-7177-4aaa-b5c4-ff31b4796abf"},{"displayName":"استراحة 🛋️","createdDateTime":"2024-04-20T19:44:06Z","isChecked":false,"id":"9eacef14-cabd-4537-a691-272731e85561"}]}}}]}'
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
