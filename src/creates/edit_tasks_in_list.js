const {TodoManager} = require("../kit/imps/todo-manager");
const {Action} = require("../kit/foundations/bulk");
const {v4: uuidv4} = require("uuid");
const _ = require('lodash');

module.exports = {
    display: {
        description: 'Edits Tasks in a List',
        hidden: false,
        label: 'Edit Tasks in a List',
    },
    key: 'edit_tasks_in_list',
    noun: 'Tasks',
    operation: {
        inputFields: [
            {
                key: 'notionTasksObject',
                label: 'Edited Notion Tasks',
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

            manager.asEditedTasks.provide(notionTasks)

            const microsoftData = await manager.asEditedTasks.apply()

            const [deletedItems, restItems] = _.partition(
                microsoftData,
                (
                    {
                        extension: {
                            operation,
                            airtableRecordId,
                        }
                    }
                ) => operation === 'delete' && airtableRecordId)

            const [deletedTasks, deletedChecklistItems] = _.partition(deletedItems, ({extension: {type}}) => type === 'task')

            const data = Action.connect(
                notionTasks,
                restItems,
                "id",
                "extension.notionId",
                "flat"
            )

            const [restTasks, restChecklistItems] = _.partition(data, ([, , {extension: {type}}]) => type === 'task')

            await manager.editData(
                restTasks.map(
                    ([, {id: notionId, ...notionData}, {
                        body: {id: microsoftId, ...microsoftData},
                        extension: {airtableRecordId}
                    }]) => [
                        airtableRecordId,
                        notionId,
                        microsoftId,
                        JSON.stringify({id: notionId, ...notionData}),
                        JSON.stringify({id: microsoftId, ...microsoftData})
                    ]
                )
            )

            await manager.deleteData(
                deletedTasks.map(
                    ({extension: {airtableRecordId}}) => airtableRecordId
                )
            )

            await manager.storeIds(
                restChecklistItems.filter(
                    ([, , {extension: {airtableRecordId}}]) => !airtableRecordId
                ).map(
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

            await manager.deleteIds(
                deletedChecklistItems.map(
                    ({extension: {airtableRecordId}}) => airtableRecordId
                )
            )

            return {
                id: uuidv4(),
                data: microsoftData.map(
                    ({body}) => body
                ).filter(
                    (body => !_.isEmpty(body))
                )
            }
        },
    },
};
