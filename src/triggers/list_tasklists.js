const createGraphClient = require('../microsoft/clients/graph/index')
const {Todo} = require("../kit/foundations/microsoft/todo");

module.exports = {
    operation: {
        perform: async (z, bundle) => {
            const todo = new Todo(createGraphClient(bundle.authData.access_token), z)
            await todo.validateAccessToken()
            return await todo.taskLists()
        },
        sample: {
            '@odata.etag': 'W/"8NnOotMXhUieb2t2gkvYawAG/8FsAA=="',
            displayName: 'Tasks',
            isOwner: true,
            isShared: false,
            wellknownListName: 'defaultList',
            id: 'AQMkADAwATMwMAItZDYzOC0wNGI0LTAwAi0wMAoALgAAA_5O2q_UDY9Cqvocq3zbHoYBAPDZzqLTF4VInm9rdoJL2GsAAAIBEgAAAA==',
        },
        outputFields: [
            {key: '@odata.etag'},
            {key: 'displayName'},
            {key: 'isOwner', type: 'boolean'},
            {key: 'isShared', type: 'boolean'},
            {key: 'wellknownListName'},
            {key: 'id'},
        ],
    },
    display: {
        description: 'Triggers when a new task list is created.',
        hidden: true,
        label: 'List Task Lists',
    },
    key: 'list_tasklists',
    noun: 'Task List',
};
