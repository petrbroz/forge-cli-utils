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
    if (err instanceof Error) {
        console.error(err.message);
    } else {
        console.error(err);
    }
    process.exit(1);
}

module.exports = {
    log,
    warn,
    error
};
