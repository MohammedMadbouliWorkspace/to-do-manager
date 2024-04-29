const zapier = require('zapier-platform-core');

// Use this to make test calls into your app:
const App = require('../../index');
const appTester = zapier.createAppTester(App);
// read the `.env` file into the environment, if available
zapier.tools.env.inject();
const { EDIT_TASKS_INPUT } = require('../../../.mock.json');

describe('creates.edit_tasks_in_list', () => {
    it('should run', async () => {
        const bundle = {
            authData: {
                access_token: process.env.ACCESS_TOKEN
            },
            inputData: {
                notionTasksObject: JSON.stringify(EDIT_TASKS_INPUT),
                airtablePersonalAccessToken: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
                airtableBaseId: process.env.AIRTABLE_BASE_ID,
                airtableIdsTableId: process.env.AIRTABLE_IDS_TABLE_ID,
                airtableDataTableId: process.env.AIRTABLE_DATA_TABLE_ID,
                airtableSyncCheckpointsTableId: process.env.AIRTABLE_SYNC_CHECKPOINTS_TABLE_ID,
                listId: process.env.MS_TODO_LIST_ID,
                timeZone: process.env.TIMEZONE
            }
        };

        const results = await appTester(
            App.creates['edit_tasks_in_list'].operation.perform,
            bundle
        );
        expect(results).toBeDefined();
    }, 100000);
});
