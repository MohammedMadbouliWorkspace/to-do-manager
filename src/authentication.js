module.exports = {
    type: 'oauth2',
    test: {
        headers: {Authorization: 'Bearer {{bundle.authData.access_token}}'},
        url: 'https://graph.microsoft.com/v1.0/me',
    },
    oauth2Config: {
        authorizeUrl: {
            method: 'GET',
            url: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
            params: {
                client_id: '{{process.env.CLIENT_ID}}',
                state: '{{bundle.inputData.state}}',
                redirect_uri: '{{bundle.inputData.redirect_uri}}',
                response_type: 'code',
            },
        },
        getAccessToken: {
            body: {
                code: '{{bundle.inputData.code}}',
                client_id: '{{process.env.CLIENT_ID}}',
                client_secret: '{{process.env.CLIENT_SECRET}}',
                grant_type: 'authorization_code',
                redirect_uri: '{{bundle.inputData.redirect_uri}}',
            },
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                accept: 'application/json',
            },
            method: 'POST',
            url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        },
        refreshAccessToken: {
            body: {
                refresh_token: '{{bundle.authData.refresh_token}}',
                grant_type: 'refresh_token',
                client_id: '{{process.env.CLIENT_ID}}',
                client_secret: '{{process.env.CLIENT_SECRET}}',
            },
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                accept: 'application/json',
            },
            method: 'POST',
            url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        },
        scope:
            'offline_access  User.Read  Tasks.ReadWrite  Tasks.ReadWrite.Shared  MailboxSettings.ReadWrite',
        autoRefresh: true,
    },
    connectionLabel: async (z, bundle) =>
        z.request(
            {
                url: 'https://graph.microsoft.com/v1.0/me',
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${bundle.authData.access_token}`,
                },
            }
        ).then((response) => {
            response.throwForStatus();
            const {displayName, mail} = response.json;

            return `${displayName} • ${mail}`;
        })
};
