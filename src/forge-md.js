#!/usr/bin/env node

const program = require('commander');
const { prompt } = require('inquirer');

const { AuthenticationClient, ModelDerivativeClient } = require('forge-nodejs-utils');

const { FORGE_CLIENT_ID, FORGE_CLIENT_SECRET } = process.env;
if (!FORGE_CLIENT_ID || !FORGE_CLIENT_SECRET) {
    console.warn('Provide FORGE_CLIENT_ID and FORGE_CLIENT_SECRET as env. variables.');
    return;
}
const auth = new AuthenticationClient(FORGE_CLIENT_ID, FORGE_CLIENT_SECRET);
const modelDerivative = new ModelDerivativeClient(auth);

async function promptViewable(urn) {
    const metadata = await modelDerivative.getMetadata(urn);
    const viewables = metadata.data.metadata;
    const answer = await prompt({ type: 'list', name: 'viewable', choices: viewables.map(viewable => viewable.guid + ' (' + viewable.name + ')') });
    return answer.viewable.substr(0, answer.viewable.indexOf(' '));
}

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

program
    .version('0.3.0')
    .description('Command-line tool for accessing Autodesk Forge Model Derivative service.');

program
    .command('list-formats')
    .alias('lf')
    .description('List supported formats.')
    .action(async function() {
        const formats = await modelDerivative.formats();
        output(formats);
    });

program
    .command('translate <urn>')
    .alias('t')
    .description('Start translation job.')
    .option('-t, --type <type>', 'Output type ("svf" by default).', 'svf')
    .option('-v, --views <views>', 'Comma-separated list of requested views ("2d,3d" by default)', '2d,3d')
    .action(async function(urn, command) {
        const outputs = [{ type: command.type, views: command.views.split(',') }];
        await modelDerivative.submitJob(urn, outputs);
    });

program
    .command('get-manifest <urn>')
    .alias('gm')
    .description('Get manifest of derivative.')
    .option('-s, --short', 'Return status of manifest instead of the entire JSON.')
    .action(async function(urn, command) {
        const manifest = await modelDerivative.getManifest(urn);
        output(command.short ? manifest.status : manifest);
    });

program
    .command('get-metadata <urn>')
    .alias('gx')
    .description('Get metadata of derivative.')
    .option('-s, --short', 'Return GUIDs of viewables instead of the entire JSON.')
    .action(async function(urn, command) {
        const metadata = await modelDerivative.getMetadata(urn);
        if (command.short) {
            metadata.data.metadata.forEach(viewable => output(viewable.guid));
        } else {
            output(metadata);
        }
    });

program
    .command('get-viewable-tree <urn> [guid]')
    .alias('gvt')
    .description('Get object tree of specific viewable.')
    .action(async function(urn, guid, command) {
        if (!guid) {
            guid = await promptViewable(urn);
        }

        const tree = await modelDerivative.getViewableTree(urn, guid);
        output(tree);
    });

program
    .command('get-viewable-props <urn> [guid]')
    .alias('gvp')
    .description('Get properties of specific viewable.')
    .action(async function(urn, guid, command) {
        if (!guid) {
            guid = await promptViewable(urn);
        }

        const props = await modelDerivative.getViewableProperties(urn, guid);
        output(props);
    });

program.parse(process.argv);
