const {TodoManager} = require("../kit/imps/todo-manager");
const {Action} = require("../kit/foundations/bulk");
const {v4: uuidv4} = require('uuid');
const _ = require('lodash');

module.exports = {
    display: {
        description: 'Maps Tasks in a List',
        hidden: false,
        label: 'Map Tasks in a List',
    },
    key: 'map_tasks_in_list',
    noun: 'Tasks',
    operation: {
        inputFields: [
            {
                key: 'notionTasksObject',
                label: 'New Notion Tasks',
                type: 'string',
                required: true,
                list: false,
                altersDynamicFields: false,
            },
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
            id: "97edb863-1986-4800-8589-34efdecccfdb",
            data: [
                {
                    '@odata.context': "https://graph.microsoft.com/v1.0/$metadata#users('memm9999%40gmail.com')/todo/lists('AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoALgAAA_5O2q_UDY9Cqvocq3zbHoYBAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAA%3D%3D')/tasks/$entity",
                    '@odata.etag': 'W/"8NnOotMXhUieb2t2gkvYawAHGl8kyg=="',
                    importance: 'normal',
                    isReminderOn: false,
                    status: 'notStarted',
                    title: '🏫 الكلية',
                    createdDateTime: '2024-04-02T20:21:24.138068Z',
                    lastModifiedDateTime: '2024-04-02T20:21:26.3005285Z',
                    hasAttachments: false,
                    categories: [],
                    id: 'AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsABxpDm-wAAAA=',
                    body: {content: '', contentType: 'text'},
                    dueDateTime: {dateTime: '2024-03-31T22:00:00.0000000', timeZone: 'UTC'},
                    startDateTime: {dateTime: '2024-03-31T22:00:00.0000000', timeZone: 'UTC'},
                    'checklistItems@odata.context': "https://graph.microsoft.com/v1.0/$metadata#users('memm9999%40gmail.com')/todo/lists('AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoALgAAA_5O2q_UDY9Cqvocq3zbHoYBAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAA%3D%3D')/tasks('AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsABxpDm-wAAAA%3D')/checklistItems",
                    checklistItems: []
                },
                {
                    '@odata.context': "https://graph.microsoft.com/v1.0/$metadata#users('memm9999%40gmail.com')/todo/lists('AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoALgAAA_5O2q_UDY9Cqvocq3zbHoYBAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAA%3D%3D')/tasks('AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsABxpDm-wAAAA%3D')/checklistItems/$entity",
                    displayName: '⚙️ سكشن 1',
                    createdDateTime: '2024-04-02T20:21:25Z',
                    isChecked: false,
                    id: '70205d3a-23e2-41e8-9b14-891309d3f2c8'
                },
                {
                    '@odata.context': "https://graph.microsoft.com/v1.0/$metadata#users('memm9999%40gmail.com')/todo/lists('AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoALgAAA_5O2q_UDY9Cqvocq3zbHoYBAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAA%3D%3D')/tasks('AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsABxpDm-wAAAA%3D')/checklistItems/$entity",
                    displayName: '⚙️ سكشن 2',
                    createdDateTime: '2024-04-02T20:21:25Z',
                    isChecked: false,
                    id: 'a97df64a-c10e-4695-ad06-cc734cd458db'
                },
                {
                    '@odata.context': "https://graph.microsoft.com/v1.0/$metadata#users('memm9999%40gmail.com')/todo/lists('AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoALgAAA_5O2q_UDY9Cqvocq3zbHoYBAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAA%3D%3D')/tasks('AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoARgAAA_5O2q_UDY9Cqvocq3zbHoYHAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAPDZzqLTF4VInm9rdoJL2GsABxpDm-wAAAA%3D')/checklistItems/$entity",
                    displayName: '📋 محاضرة',
                    createdDateTime: '2024-04-02T20:21:26.2519348Z',
                    isChecked: false,
                    id: 'ae18b076-5109-44a1-a78b-21a457370a8b'
                }
            ]
        },
        outputFields: [
            {key: 'id'},
            {key: 'data'}
        ],
        perform: async (z, bundle) => {
            const notionTasks = JSON.parse(bundle.inputData.notionTasksObject)

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
                    },
                    timeZone: bundle.inputData.timeZone
                }
            )

            await manager.validateAccess()

            manager.asAddedTasks.provide(notionTasks)

            const microsoftData = await manager.asAddedTasks.apply()

            const data = Action.connect(
                notionTasks,
                microsoftData,
                "id",
                "extension.notionId",
                "flat"
            )

            const [tasks, checklistItems] = _.partition(data, ([, , {extension: {type}}]) => type === 'task')

            await manager.storeData(
                tasks.map(
                    ([, {id: notionId, ...notionData}, {body: {id: microsoftId, ...microsoftData}}]) => [
                        notionId,
                        microsoftId,
                        JSON.stringify({id: notionId, ...notionData}),
                        JSON.stringify({id: microsoftId, ...microsoftData})
                    ]
                )
            )

            await manager.storeIds(
                checklistItems.map(
                    ([, {id: notionId}, {
                        body: {id: microsoftId},
                        extension: {parentNotionId = "", parentMicrosoftId = ""}
                    }]) => [
                        notionId,
                        microsoftId,
                        parentNotionId,
                        parentMicrosoftId
                    ]
                )
            )

            return {
                id: uuidv4(),
                data: microsoftData.map(
                    ({body}) => body
                ).filter(
                    (
                        body => {
                            const {error} = body
                            return !_.isEmpty(body) && !error
                        }
                    )
                )
            }
        },
    },
};
