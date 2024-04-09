const zapier = require('zapier-platform-core');
zapier.tools.env.inject();

const App = require('../../index');
const appTester = zapier.createAppTester(App);

describe('triggers.list_tasklists', () => {
    it('should run', async () => {

        const bundle = {
            inputData: {},
            authData: {
                access_token: process.env.ACCESS_TOKEN
            }
        };

        const results = await appTester(
            App.triggers['list_tasklists'].operation.perform,
            bundle
        );

        expect(results).toBeDefined();
    });
});
