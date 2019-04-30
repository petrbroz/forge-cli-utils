#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

const program = require('commander');
const { prompt } = require('inquirer');
const FormData = require('form-data');

const { AuthenticationClient, DataManagementClient, DesignAutomationClient, DesignAutomationURI } = require('forge-nodejs-utils');

const { FORGE_CLIENT_ID, FORGE_CLIENT_SECRET } = process.env;
if (!FORGE_CLIENT_ID || !FORGE_CLIENT_SECRET) {
    console.warn('Provide FORGE_CLIENT_ID and FORGE_CLIENT_SECRET as env. variables.');
    return;
}
const auth = new AuthenticationClient(FORGE_CLIENT_ID, FORGE_CLIENT_SECRET);
const data = new DataManagementClient(auth);
const designAutomation = new DesignAutomationClient(auth);

async function promptEngine() {
    const engines = await designAutomation.listEngines();
    const answer = await prompt({ type: 'list', name: 'engine', choices: engines });
    return answer.engine;
}

async function promptAppBundle() {
    const bundles = await designAutomation.listAppBundles();
    const uniqueBundleNames = new Set(bundles.map(bundle => {
        const uri = new DesignAutomationURI(bundle);
        return uri.name;
    }));
    const answer = await prompt({ type: 'list', name: 'bundle', choices: Array.from(uniqueBundleNames.values()) });
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

async function promptActivity(nameOnly = true) {
    const activities = await designAutomation.listActivities();
    const uniqueActivityNames = new Set(activities.map(activity => {
        const uri = new DesignAutomationURI(activity);
        return nameOnly ? uri.name : activity;
    }));
    const answer = await prompt({ type: 'list', name: 'activity', choices: Array.from(uniqueActivityNames.values()) });
    return answer.activity;
}

async function promptActivityVersion(activity) {
    const versions = await designAutomation.listActivityVersions(activity);
    const answer = await prompt({ type: 'list', name: 'version', choices: versions });
    return answer.version;
}

async function promptActivityAlias(activity) {
    const activities = await designAutomation.listActivityAliases(activity);
    const answer = await prompt({ type: 'list', name: 'alias', choices: activities });
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
            for await (const bundles of designAutomation.iterateActivities()) {
                bundles.forEach(bundle => console.log(bundle));
            }
        } else {
            console.log(await designAutomation.listActivities());
        }
    });

function _collectActivityInputs(val, memo) {
    memo.push({ name: val });
    return memo;
}

function _collectActivityOutputs(val, memo) {
    const tokens = val.split(':');
    memo.push({ name: tokens[0], localName: tokens[1] });
    return memo;
}

program
    .command('create-activity <name> [bundle] [bundlealias] [engine]')
    .alias('ca')
    .description('Create new activity.')
    .option('-s, --short', 'Output app bundle ID instead of the entire JSON.')
    .option('-d, --description <description>', 'Optional activity description.')
    .option('--script', 'Optional engine-specific script to pass to activity.')
    .option('-i, --input <name>', 'Activity input (can be used multiple times).', _collectActivityInputs, [])
    .option('-o, --output <name>', 'Activity output defined as <id>:<localName> (can be used multiple times).', _collectActivityOutputs, [])
    .action(async function(name, bundle, bundlealias, engine, command) {
        if (!bundle) {
            bundle = await promptAppBundle();
        }
        if (!bundlealias) {
            bundlealias = await promptAppBundleAlias(bundle);
        }
        if (!engine) {
            engine = await promptEngine();
        }
        let description = command.description;
        if (!description) {
            description = `${name} created via Forge CLI Utils.`;
        }

        let activity = await designAutomation.createActivity(name, description, bundle, bundlealias, engine, command.input, command.output, command.script);
        if (command.short) {
            console.log(activity.id);
        } else {
            console.log(activity);
        }
    });

program
    .command('update-activity <name> [bundle] [bundlealias] [engine]')
    .alias('ua')
    .description('Update existing activity.')
    .option('-s, --short', 'Output app bundle ID instead of the entire JSON.')
    .option('-d, --description <description>', 'Optional activity description.')
    .option('--script', 'Optional engine-specific script to pass to activity.')
    .option('-i, --input <name>', 'Activity input (can be used multiple times).', _collectActivityInputs, [])
    .option('-o, --output <name>', 'Activity output defined as <id>:<localName> (can be used multiple times).', _collectActivityOutputs, [])
    .action(async function(name, bundle, bundlealias, engine, command) {
        if (!bundle) {
            bundle = await promptAppBundle();
        }
        if (!bundlealias) {
            bundlealias = await promptAppBundleAlias(bundle);
        }
        if (!engine) {
            engine = await promptEngine();
        }
        let description = command.description;
        if (!description) {
            description = `${name} created via Forge CLI Utils.`;
        }

        let activity = await designAutomation.updateActivity(name, description, bundle, bundlealias, engine, command.input, command.output, command.script);
        if (command.short) {
            console.log(activity.id);
        } else {
            console.log(activity);
        }
    });

program
    .command('list-activity-versions [activity]')
    .alias('lav')
    .description('List activity versions.')
    .option('-s, --short', 'Output version numbers instead of the entire JSON.')
    .action(async function(activity, command) {
        if (!activity) {
            activity = await promptActivity();
        }

        if (command.short) {
            for await (const versions of designAutomation.iterateActivityVersions(activity)) {
                versions.forEach(version => console.log(version));
            }
        } else {
            console.log(await designAutomation.listActivityVersions(activity));
        }
    });

program
    .command('list-activity-aliases [activity]')
    .alias('laa')
    .description('List activity aliases.')
    .option('-s, --short', 'Output activity aliases instead of the entire JSON.')
    .action(async function(activity, command) {
        if (!activity) {
            activity = await promptActivity();
        }

        if (command.short) {
            for await (const aliases of designAutomation.iterateActivityAliases(activity)) {
                aliases.forEach(alias => console.log(alias.id));
            }
        } else {
            console.log(await designAutomation.listActivityAliases(activity));
        }
    });

program
    .command('create-activity-alias <alias> [activity] [version]')
    .alias('caa')
    .description('Create new activity alias.')
    .option('-s, --short', 'Output alias name instead of the entire JSON.')
    .action(async function(alias, activity, version, command) {
        if (!activity) {
            activity = await promptActivity();
        }
        if (!version) {
            version = await promptActivityVersion(activity);
        }

        let aliasObject = await designAutomation.createActivityAlias(activity, alias, parseInt(version));
        if (command.short) {
            console.log(aliasObject.id);
        } else {
            console.log(aliasObject);
        }
    });

program
    .command('update-activity-alias <alias> [activity] [version]')
    .alias('uaa')
    .description('Update existing activity alias.')
    .option('-s, --short', 'Output alias name instead of the entire JSON.')
    .action(async function(alias, activity, version, command) {
        if (!activity) {
            activity = await promptActivity();
        }
        if (!version) {
            version = await promptActivityVersion(activity);
        }

        let aliasObject = await designAutomation.updateActivityAlias(activity, alias, parseInt(version));
        if (command.short) {
            console.log(aliasObject.id);
        } else {
            console.log(aliasObject);
        }
    });

function _collectWorkitemInputs(val, memo) {
    const split = val.indexOf(':');
    memo.push({ name: val.substr(0, split), url: val.substr(split + 1) });
    return memo;
}

function _collectWorkitemOutputs(val, memo) {
    const split = val.indexOf(':');
    memo.push({ name: val.substr(0, split), url: val.substr(split + 1) });
    return memo;
}

program
    .command('create-workitem [activity] [activityalias]')
    .alias('cw')
    .description('Create new work item.')
    .option('-s, --short', 'Output work item ID instead of the entire JSON.')
    .option('-i, --input <name>', 'Work item input defined as <id>:<url> (can be used multiple times).', _collectWorkitemInputs, [])
    .option('-o, --output <name>', 'Work item output defined as <id>:<url> (can be used multiple times).', _collectWorkitemOutputs, [])
    .action(async function(activity, activityalias, command) {
        if (!activity) {
            activity = await promptActivity(false);
        }
        if (!activityalias) {
            activityalias = await promptActivityAlias(activity);
        }

        const activityId = designAutomation.auth.client_id + '.' + activity + '+' + activityalias;
        const workitem = await designAutomation.createWorkItem(activityId, command.input, command.output);
        if (command.short) {
            console.log(workitem.id);
        } else {
            console.log(workitem);
        }
    });

program
    .command('get-workitem <id>')
    .alias('cw')
    .description('Get work item details.')
    .option('-s, --short', 'Output work item status instead of the entire JSON.')
    .action(async function(id, command) {
        const workitem = await designAutomation.workItemDetails(id);
        if (command.short) {
            console.log(workitem.status);
        } else {
            console.log(workitem);
        }
    });

program.parse(process.argv);
