const zapier = require('zapier-platform-core');
const App = require('../../index');
const appTester = zapier.createAppTester(App);
zapier.tools.env.inject();

describe('triggers.list_airtable_tables', () => {
    it('should run', async () => {
        const bundle = {
            inputData: {
                airtableBaseId: process.env.AIRTABLE_BASE_ID,
                airtablePersonalAccessToken: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN
            }
        };

        const results = await appTester(
            App.triggers['list_airtable_tables'].operation.perform,
            bundle
        );
        expect(results).toBeDefined();
    });
});
