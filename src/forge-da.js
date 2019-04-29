#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

const program = require('commander');
const { prompt } = require('inquirer');
const FormData = require('form-data');

const { AuthenticationClient, DataManagementClient, DesignAutomationClient } = require('forge-nodejs-utils');

const { FORGE_CLIENT_ID, FORGE_CLIENT_SECRET } = process.env;
if (!FORGE_CLIENT_ID || !FORGE_CLIENT_SECRET) {
    console.warn('Provide FORGE_CLIENT_ID and FORGE_CLIENT_SECRET as env. variables.');
    return;
}
const auth = new AuthenticationClient(FORGE_CLIENT_ID, FORGE_CLIENT_SECRET);
const data = new DataManagementClient(auth);
const designAutomation = new DesignAutomationClient(auth);

function extractAppBundleID(fullAppBundleName) {
    const start = fullAppBundleName.indexOf('.') + 1;
    const end = fullAppBundleName.indexOf('+');
    return fullAppBundleName.substr(start, end !== -1 ? (end - start) : fullAppBundleName.length - start);
}

async function promptEngine() {
    const engines = await designAutomation.listEngines();
    const answer = await prompt({ type: 'list', name: 'engine', choices: engines });
    return answer.engine;
}

async function promptAppBundle() {
    const bundles = await designAutomation.listAppBundles();
    const uniqueBundles = new Set(bundles.map(extractAppBundleID));
    const answer = await prompt({ type: 'list', name: 'bundle', choices: Array.from(uniqueBundles.values()) });
    return answer.bundle;
}

async function promptAppBundleVersion(appbundle) {
    const versions = await designAutomation.listAppBundleVersions(appbundle);
    const answer = await prompt({ type: 'list', name: 'version', choices: versions });
    return answer.version;
}

async function promptAppBundleAlias(appbundle) {
    const aliases = await designAutomation.listAppBundleAliases(appbundle);
    const answer = await prompt({ type: 'list', name: 'alias', choices: aliases });
    return answer.alias;
}

function uploadAppBundleFile(appBundle, appBundleFilename) {
    const uploadParameters = appBundle.uploadParameters.formData;
    const form = new FormData();
    form.append('key', uploadParameters['key']);
    form.append('policy', uploadParameters['policy']);
    form.append('content-type', uploadParameters['content-type']);
    form.append('success_action_status', uploadParameters['success_action_status']);
    form.append('success_action_redirect', uploadParameters['success_action_redirect']);
    form.append('x-amz-signature', uploadParameters['x-amz-signature']);
    form.append('x-amz-credential', uploadParameters['x-amz-credential']);
    form.append('x-amz-algorithm', uploadParameters['x-amz-algorithm']);
    form.append('x-amz-date', uploadParameters['x-amz-date']);
    form.append('x-amz-server-side-encryption', uploadParameters['x-amz-server-side-encryption']);
    form.append('x-amz-security-token', uploadParameters['x-amz-security-token']);
    form.append('file', fs.createReadStream(appBundleFilename));
    return new Promise(function(resolve, reject) {
        form.submit(appBundle.uploadParameters.endpointURL, function(err, res) {
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

program
    .version('0.2.0')
    .description('Command-line tool for accessing Autodesk Forge Design Automation service.');

program
    .command('list-engines')
    .alias('le')
    .description('List engines.')
    .option('-s, --short', 'Output engine IDs instead of the entire JSON.')
    .action(async function(command) {
        if (command.short) {
            for await (const engines of designAutomation.iterateEngines()) {
                engines.forEach(engine => console.log(engine));
            }
        } else {
            console.log(await designAutomation.listEngines());
        }
    });

program
    .command('list-appbundles')
    .alias('lb')
    .description('List app bundles.')
    .option('-s, --short', 'Output app bundle IDs instead of the entire JSON.')
    .action(async function(command) {
        if (command.short) {
            for await (const bundles of designAutomation.iterateAppBundles()) {
                bundles.forEach(bundle => console.log(bundle));
            }
        } else {
            console.log(await designAutomation.listAppBundles());
        }
    });

program
    .command('create-appbundle <name> <filename> [engine] [description]')
    .alias('cb')
    .description('Create new app bundle.')
    .option('-s, --short', 'Output app bundle ID instead of the entire JSON.')
    .action(async function(name, filename, engine, description, command) {
        if (!engine) {
            engine = await promptEngine();
        }
        if (!description) {
            description = `${name} created via Forge CLI Utils.`;
        }

        let appBundle = await designAutomation.createAppBundle(name, engine, description);
        await uploadAppBundleFile(appBundle, filename);
        if (command.short) {
            console.log(appBundle.id);
        } else {
            console.log(appBundle);
        }
    });

program
    .command('update-appbundle <appbundle> <filename> [engine] [description]')
    .alias('ub')
    .description('Update existing app bundle.')
    .option('-s, --short', 'Output app bundle ID instead of the entire JSON.')
    .action(async function(appbundle, filename, engine, description, command) {
        let appBundle = await designAutomation.updateAppBundle(appbundle, engine, description);
        await uploadAppBundleFile(appBundle, filename);
        if (command.short) {
            console.log(appBundle.id);
        } else {
            console.log(appBundle);
        }
    });

program
    .command('list-appbundle-versions [appbundle]')
    .alias('lbv')
    .description('List app bundle versions.')
    .option('-s, --short', 'Output version numbers instead of the entire JSON.')
    .action(async function(appbundle, command) {
        if (!appbundle) {
            appbundle = await promptAppBundle();
        }

        if (command.short) {
            for await (const versions of designAutomation.iterateAppBundleVersions(appbundle)) {
                versions.forEach(version => console.log(version));
            }
        } else {
            console.log(await designAutomation.listAppBundleVersions(appbundle));
        }
    });

program
    .command('list-appbundle-aliases [appbundle]')
    .alias('lba')
    .description('List app bundle aliases.')
    .option('-s, --short', 'Output app bundle aliases instead of the entire JSON.')
    .action(async function(appbundle, command) {
        if (!appbundle) {
            appbundle = await promptAppBundle();
        }

        if (command.short) {
            for await (const aliases of designAutomation.iterateAppBundleAliases(appbundle)) {
                aliases.forEach(alias => console.log(alias.id));
            }
        } else {
            console.log(await designAutomation.listAppBundleAliases(appbundle));
        }
    });

program
    .command('create-appbundle-alias <alias> [appbundle] [version]')
    .alias('cba')
    .description('Create new app bundle alias.')
    .option('-s, --short', 'Output alias name instead of the entire JSON.')
    .action(async function(alias, appbundle, version, command) {
        if (!appbundle) {
            appbundle = await promptAppBundle();
        }
        if (!version) {
            version = await promptAppBundleVersion(appbundle);
        }

        let aliasObject = await designAutomation.createAppBundleAlias(appbundle, alias, parseInt(version));
        if (command.short) {
            console.log(aliasObject.id);
        } else {
            console.log(aliasObject);
        }
    });

program
    .command('update-appbundle-alias <alias> [appbundle] [version]')
    .alias('uba')
    .description('Update existing app bundle alias.')
    .option('-s, --short', 'Output alias name instead of the entire JSON.')
    .action(async function(alias, appbundle, version, command) {
        if (!appbundle) {
            appbundle = await promptAppBundle();
        }
        if (!version) {
            version = await promptAppBundleVersion(appbundle);
        }

        let aliasObject = await designAutomation.updateAppBundleAlias(appbundle, alias, parseInt(version));
        if (command.short) {
            console.log(aliasObject.id);
        } else {
            console.log(aliasObject);
        }
    });

program
    .command('list-activities')
    .alias('la')
    .description('List activities.')
    .option('-s, --short', 'Output activity IDs instead of the entire JSON.')
    .action(async function(command) {
        if (command.short) {
            for await (const bundles of designAutomation.iterateAppBundles()) {
                bundles.forEach(bundle => console.log(bundle));
            }
        } else {
            console.log(await designAutomation.listActivities());
        }
    });

program.parse(process.argv);
