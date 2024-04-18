const zapier = require('zapier-platform-core');
zapier.tools.env.inject();

const App = require('../../index');
const appTester = zapier.createAppTester(App);

describe('triggers.tasks_delta', () => {
    it('should run', async () => {

        const bundle = {
            authData: {
                access_token: process.env.ACCESS_TOKEN
            },
            inputData: {
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
            App.triggers['tasks_delta'].operation.perform,
            bundle
        );

        expect(results).toBeDefined();
    }, 100000);
});
