const { ForgeError } = require('forge-nodejs-utils/src/common');

function log(result) {
    switch (typeof result) {
        case 'object':
            console.log(JSON.stringify(result, null, 4));
            break;
        default:
            console.log(result);
            break;
    }
}

function warn(result) {
    switch (typeof result) {
        case 'object':
            console.warn(JSON.stringify(result, null, 4));
            break;
        default:
            console.warn(result);
            break;
    }
}

function error(err) {
    if (err instanceof ForgeError) {
        console.error(`Request to ${err.url} failed: ${err.data.userMessage || err.data.developerMessage}.`);
    } else if (typeof err === 'object') {
        console.error(JSON.stringify(err, null, 4));
    } else {
        console.error(err);
    }
}

module.exports = {
    log,
    warn,
    error
};
