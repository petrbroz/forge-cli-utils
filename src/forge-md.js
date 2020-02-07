#!/usr/bin/env node

const program = require('commander');
const { prompt } = require('inquirer');
const { ModelDerivativeClient } = require('forge-server-utils');
const DerivativePersistence = require('./helpers/derivativePersistence');
const package = require('../package.json');
const { log, warn, error } = require('./common');

const { FORGE_CLIENT_ID, FORGE_CLIENT_SECRET } = process.env;
if (!FORGE_CLIENT_ID || !FORGE_CLIENT_SECRET) {
    warn('Provide FORGE_CLIENT_ID and FORGE_CLIENT_SECRET as env. variables.');
    return;
}
const modelDerivative = new ModelDerivativeClient({ client_id: FORGE_CLIENT_ID, client_secret: FORGE_CLIENT_SECRET });

async function promptViewable(urn) {
    const metadata = await modelDerivative.getMetadata(urn);
    const viewables = metadata.data.metadata;
    const answer = await prompt({ type: 'list', name: 'viewable', choices: viewables.map(viewable => viewable.guid + ' (' + viewable.name + ')') });
    return answer.viewable.substr(0, answer.viewable.indexOf(' '));
}

function sleep(ms) {
    return new Promise(function(resolve) {
        setTimeout(resolve, ms);
    });
}

program
    .version(package.version)
    .description('Command-line tool for accessing Autodesk Forge Model Derivative service.');

program
    .command('list-formats [input-type]')
    .alias('lf')
    .description('List supported output formats for specific input type or for all input types.')
    .action(async function(inputType) {
        try {
            const formats = await modelDerivative.formats();
            if (inputType) {
                log(Object.keys(formats).filter(key => formats[key].includes(inputType)));
            } else {
                log(formats);
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('translate <urn>')
    .alias('t')
    .description('Start translation job.')
    .option('-t, --type <type>', 'Output type ("svf" by default). See `forge-md list-formats` for all possible output types.', 'svf')
    .option('-v, --views <views>', 'Comma-separated list of requested views ("2d,3d" by default)', '2d,3d')
    .option('-w, --wait', 'Wait for the translation to complete.', false)
    .action(async function(urn, command) {
        try {
            const outputs = [{ type: command.type, views: command.views.split(',') }];
            await modelDerivative.submitJob(urn, outputs);
    
            if (command.wait) {
                let manifest = await modelDerivative.getManifest(urn);
                while (manifest.status === 'inprogress') {
                    await sleep(5000);
                }
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('get-manifest <urn>')
    .alias('gm')
    .description('Get manifest of derivative.')
    .option('-s, --short', 'Return status of manifest instead of the entire JSON.')
    .action(async function(urn, command) {
        try {
            const manifest = await modelDerivative.getManifest(urn);
            log(command.short ? manifest.status : manifest);
        } catch(err) {
            error(err);
        }
    });

program
    .command('get-metadata <urn>')
    .alias('gx')
    .description('Get metadata of derivative.')
    .option('-s, --short', 'Return GUIDs of viewables instead of the entire JSON.')
    .action(async function(urn, command) {
        try {
            const metadata = await modelDerivative.getMetadata(urn);
            if (command.short) {
                metadata.data.metadata.forEach(viewable => log(viewable.guid));
            } else {
                log(metadata);
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('get-viewable-tree <urn> [guid]')
    .alias('gvt')
    .description('Get object tree of specific viewable.')
    .action(async function(urn, guid, command) {
        try {
            if (!guid) {
                guid = await promptViewable(urn);
            }

            const tree = await modelDerivative.getViewableTree(urn, guid);
            log(tree);
        } catch (err) {
            error(err);
        }
    });

program
    .command('get-viewable-props <urn> [guid]')
    .alias('gvp')
    .description('Get properties of specific viewable.')
    .action(async function(urn, guid, command) {
        try {
            if (!guid) {
                guid = await promptViewable(urn);
            }

            const props = await modelDerivative.getViewableProperties(urn, guid);
            log(props);
        } catch (err) {
            error(err);
        }
    });

program
    .command('download-derivatives <urn>')
    .alias('dd')
    .description('Download derivatives .')
    .option('-c, --directory <directory>', 'Specifies the output directory.')
    .option('-u, --guid <guid>', 'Specifies GUIDs of the derivatives to download, separated by comma e.g. `-u "a0798102-7662-0a66-e0d2-cf982c29eb9a, 593a30e5-12b8-41b3-a3c1-d02fc80dad24-0018d776"`')
    .action(async function(urn, command) {     
        try {
            const manifest = await modelDerivative.getManifest(urn);
            if (manifest.progress == 'complete' && manifest.status == 'success' && manifest.derivatives instanceof Array)
            {
                const derivativePersistenceClient = new DerivativePersistence(modelDerivative, urn, command.directory);
                derivativePersistenceClient.setOutputDirectory(command.directory);
                await derivativePersistenceClient.fetch(manifest.derivatives, command.guid);                               
            }    
            else error('Job not completed or failed - check manifest for details.')
        } catch (err) {
            error(err);
        }
    });

program.parse(process.argv);
if (!program.args.length) {
    program.help();
}
