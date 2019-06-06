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
        console.error(`Request to ${err.url} failed: ${err.message}.`);
        process.exit(1);
    } else {
        throw err;
    }
}

module.exports = {
    log,
    warn,
    error
};
