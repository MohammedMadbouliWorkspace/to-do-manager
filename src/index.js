const authentication = require('./authentication');
const listTasklistsTrigger = require('./triggers/list_tasklists.js');
const listAirtableBasesTrigger = require('./triggers/list_airtable_bases.js');
const listAirtableTablesTrigger = require('./triggers/list_airtable_tables.js');
const tasksDeltaTrigger = require('./triggers/tasks_delta.js');
const mapTasksInListCreate = require('./creates/map_tasks_in_list.js');
const editTasksInListCreate = require('./creates/edit_tasks_in_list.js');

module.exports = {
  version: require('../package.json').version,
  platformVersion: require('zapier-platform-core').version,
  authentication: authentication,
  creates: {
    [mapTasksInListCreate.key]: mapTasksInListCreate,
    [editTasksInListCreate.key]: editTasksInListCreate,
  },
  triggers: {
    [listTasklistsTrigger.key]: listTasklistsTrigger,
    [listAirtableBasesTrigger.key]: listAirtableBasesTrigger,
    [listAirtableTablesTrigger.key]: listAirtableTablesTrigger,
    [tasksDeltaTrigger.key]: tasksDeltaTrigger,
  },
};
