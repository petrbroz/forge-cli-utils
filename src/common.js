function output(result) {
    switch (typeof result) {
        case 'object':
            console.log(JSON.stringify(result, null, 4));
            break;
        default:
            console.log(result);
            break;
    }
}

module.exports = {
    output
};
