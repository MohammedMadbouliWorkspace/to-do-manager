const { Client } = require('@microsoft/microsoft-graph-client');

module.exports = (accessToken) =>
    Client.initWithMiddleware({
        authProvider: {
            getAccessToken: () => accessToken
        }
    });