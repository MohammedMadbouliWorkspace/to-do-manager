const {URL} = require('node:url')
const {Request} = require("cross-fetch");

const parseODataContext = (context) => {
    const url = new URL(context);
    const {hostname: host, pathname: path} = url;
    const hashString = context.split('#')[1];
    const regex = /([^\/]+)\('([^']+)'\)/g;

    const parsedData = {host, path};

    if (hashString) {
        const segments = [...hashString.matchAll(regex)];

        for (const [, name, value] of segments) {
            const decodedValue = value.split(',').map(decodeURIComponent);
            parsedData[name] = parsedData[name] ? [...parsedData[name], ...decodedValue] : decodedValue;
        }
    }

    return parsedData;
};

const validateAccessToken = async (client, z) => {
    await client.api('/me').get().catch(
        (error) => {
            if (error.statusCode === 401) {
                throw new z.errors.RefreshAuthError();
            }
        }
    )
}

const createMeBatchStep = (id) => {
    return {
        id,
        request: new Request(
            "/me",
            {
                method: "GET"
            }
        )
    }
}

exports.parseODataContext = parseODataContext
exports.validateAccessToken = validateAccessToken
exports.createMeBatchStep = createMeBatchStep