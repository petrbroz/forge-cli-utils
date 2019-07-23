#!/usr/bin/env node

const fs = require('fs');

const program = require('commander');
const { prompt } = require('inquirer');
const FormData = require('form-data');
const { DesignAutomationClient, DesignAutomationID } = require('forge-nodejs-utils');

const package = require('../package.json');
const { log, warn, error } = require('./common');

const { FORGE_CLIENT_ID, FORGE_CLIENT_SECRET } = process.env;
if (!FORGE_CLIENT_ID || !FORGE_CLIENT_SECRET) {
    warn('Provide FORGE_CLIENT_ID and FORGE_CLIENT_SECRET as env. variables.');
    return;
}

const designAutomation = new DesignAutomationClient({ client_id: FORGE_CLIENT_ID, client_secret: FORGE_CLIENT_SECRET });

function isQualifiedID(qualifiedId) {
    return DesignAutomationID.parse(qualifiedId) !== null;
}

function decomposeQualifiedID(qualifiedId) {
    return DesignAutomationID.parse(qualifiedId);
}

async function promptEngine() {
    const engines = await designAutomation.listEngines();
    const answer = await prompt({ type: 'list', name: 'engine', choices: engines });
    return answer.engine;
}

async function promptAppBundle() {
    const bundles = await designAutomation.listAppBundles();
    const uniqueBundleNames = new Set(bundles.map(DesignAutomationID.parse).filter(item => item !== null).map(item => item.id));
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
    const answer = await prompt({ type: 'list', name: 'alias', choices: aliases.map(item => item.id).filter(id => id !== '$LATEST') });
    return answer.alias;
}

async function promptActivity(nameOnly = true) {
    const activities = await designAutomation.listActivities();
    if (nameOnly) {
        const uniqueActivityNames = new Set(activities.map(DesignAutomationID.parse).filter(item => item !== null).map(item => item.id));
        const answer = await prompt({ type: 'list', name: 'activity', choices: Array.from(uniqueActivityNames.values()) });
        return answer.activity;
    } else {
        const answer = await prompt({ type: 'list', name: 'activity', choices: activities });
        return answer.activity;
    }
}

async function promptActivityVersion(activity) {
    const versions = await designAutomation.listActivityVersions(activity);
    const answer = await prompt({ type: 'list', name: 'version', choices: versions });
    return answer.version;
}

async function promptActivityAlias(activity) {
    const aliases = await designAutomation.listActivityAliases(activity);
    const answer = await prompt({ type: 'list', name: 'alias', choices: aliases.map(item => item.id).filter(id => id !== '$LATEST') });
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
    .version(package.version)
    .description('Command-line tool for accessing Autodesk Forge Design Automation service.');

program
    .command('list-engines')
    .alias('le')
    .description('List engines.')
    .option('-s, --short', 'Output engine IDs instead of the entire JSON.')
    .action(async function(command) {
        try {
            if (command.short) {
                for await (const engines of designAutomation.iterateEngines()) {
                    engines.forEach(engine => log(engine));
                }
            } else {
                log(await designAutomation.listEngines());
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('get-engine [engine-full-id]')
    .alias('ge')
    .description('Get engine details.')
    .action(async function(engineFullId, command) {
        try {
            if (!engineFullId) {
                engineFullId = await promptEngine();
            }

            if (!isQualifiedID(engineFullId)) {
                throw new Error('Engine ID must be fully qualified ("<owner>.<id>+<version>").');
            }

            const engine = await designAutomation.getEngine(engineFullId);
            log(engine);
        } catch(err) {
            error(err);
        }
    });

program
    .command('list-appbundles')
    .alias('lb')
    .description('List app bundles.')
    .option('-s, --short', 'Output app bundle IDs instead of the entire JSON.')
    .action(async function(command) {
        try {
            if (command.short) {
                for await (const bundles of designAutomation.iterateAppBundles()) {
                    bundles.forEach(bundle => log(bundle));
                }
            } else {
                log(await designAutomation.listAppBundles());
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('get-appbundle [bundle-short-id] [bundle-alias]')
    .alias('gb')
    .description('Get appbundle details.')
    .action(async function(bundleShortId, bundleAlias, command) {
        try {
            if (!bundleShortId) {
                bundleShortId = await promptAppBundle();
            }
            if (!bundleAlias) {
                bundleAlias = await promptAppBundleAlias(bundleShortId);
            }

            const bundleFullId = new DesignAutomationID(designAutomation.auth.client_id, bundleShortId, bundleAlias);
            const appbundle = await designAutomation.getAppBundle(bundleFullId.toString());
            log(appbundle);
        } catch(err) {
            error(err);
        }
    });

async function appBundleExists(bundleShortId) {
    const appBundleIDs = await designAutomation.listAppBundles();
    const match = appBundleIDs.map(decomposeQualifiedID).find(item => item.id === bundleShortId);
    return !!match;
}

program
    .command('create-appbundle <bundle-short-id> <filename> [engine-full-id] [description]')
    .alias('cb')
    .description('Create new app bundle.')
    .option('-s, --short', 'Output app bundle ID instead of the entire JSON.')
    .option('-u, --update', 'If app bundle already exists, update it.')
    .action(async function(bundleShortId, filename, engineFullId, description, command) {
        try {
            if (!engineFullId) {
                engineFullId = await promptEngine();
            }
            if (!description) {
                description = `${bundleShortId} created via Forge CLI Utils.`;
            }
    
            let exists = false;
            if (command.update) {
                exists = await appBundleExists(bundleShortId);
            }

            let appBundle = exists
                ? await designAutomation.updateAppBundle(bundleShortId, engineFullId, description)
                : await designAutomation.createAppBundle(bundleShortId, engineFullId, description);
            await uploadAppBundleFile(appBundle, filename);
            if (command.short) {
                log(appBundle.id);
            } else {
                log(appBundle);
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('update-appbundle <bundle-short-id> <filename> [engine-full-id] [description]')
    .alias('ub')
    .description('Update existing app bundle.')
    .option('-s, --short', 'Output app bundle ID instead of the entire JSON.')
    .option('-c, --create', 'If app bundle does not exists, create it.')
    .action(async function(bundleShortId, filename, engineFullId, description, command) {
        try {
            let exists = true;
            if (command.create) {
                exists = await appBundleExists(bundleShortId);
            }

            let appBundle = exists
                ? await designAutomation.updateAppBundle(bundleShortId, engineFullId, description)
                : await designAutomation.createAppBundle(bundleShortId, engineFullId, description);
            await uploadAppBundleFile(appBundle, filename);
            if (command.short) {
                log(appBundle.id);
            } else {
                log(appBundle);
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('list-appbundle-versions [bundle-short-id]')
    .alias('lbv')
    .description('List app bundle versions.')
    .option('-s, --short', 'Output version numbers instead of the entire JSON.')
    .action(async function(bundleShortId, command) {
        try {
            if (!bundleShortId) {
                bundleShortId = await promptAppBundle();
            }
    
            if (command.short) {
                for await (const versions of designAutomation.iterateAppBundleVersions(bundleShortId)) {
                    versions.forEach(version => log(version));
                }
            } else {
                log(await designAutomation.listAppBundleVersions(bundleShortId));
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('list-appbundle-aliases [bundle-short-id]')
    .alias('lba')
    .description('List app bundle aliases.')
    .option('-s, --short', 'Output app bundle aliases instead of the entire JSON.')
    .action(async function(bundleShortId, command) {
        try {
            if (!bundleShortId) {
                bundleShortId = await promptAppBundle();
            }
    
            if (command.short) {
                for await (const aliases of designAutomation.iterateAppBundleAliases(bundleShortId)) {
                    aliases.forEach(alias => log(alias.id));
                }
            } else {
                log(await designAutomation.listAppBundleAliases(bundleShortId));
            }
        } catch(err) {
            error(err);
        }
    });

async function appBundleAliasExists(bundleShortId, bundleAlias) {
    const appBundleAliases = await designAutomation.listAppBundleAliases(bundleShortId);
    const match = appBundleAliases.find(item => item.id === bundleAlias);
    return !!match;
}

program
    .command('create-appbundle-alias <bundle-alias> [bundle-short-id] [bundle-version]')
    .alias('cba')
    .description('Create new app bundle alias.')
    .option('-s, --short', 'Output alias name instead of the entire JSON.')
    .option('-u, --update', 'If app bundle alias exists, update it.')
    .action(async function(bundleAlias, bundleShortId, bundleVersion, command) {
        try {
            if (!bundleShortId) {
                bundleShortId = await promptAppBundle();
            }
            if (!bundleVersion) {
                bundleVersion = await promptAppBundleVersion(bundleShortId);
            }
    
            let exists = false;
            if (command.update) {
                exists = await appBundleAliasExists(bundleShortId, bundleAlias);
            }

            let aliasObject = exists
                ? await designAutomation.updateAppBundleAlias(bundleShortId, bundleAlias, parseInt(bundleVersion))
                : await designAutomation.createAppBundleAlias(bundleShortId, bundleAlias, parseInt(bundleVersion));
            if (command.short) {
                log(aliasObject.id);
            } else {
                log(aliasObject);
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('update-appbundle-alias <bundle-alias> [bundle-short-id] [bundle-version]')
    .alias('uba')
    .description('Update existing app bundle alias.')
    .option('-s, --short', 'Output alias name instead of the entire JSON.')
    .option('-c, --create', 'If app bundle alias does not exist, create it.')
    .action(async function(bundleAlias, bundleShortId, bundleVersion, command) {
        try {
            if (!bundleShortId) {
                bundleShortId = await promptAppBundle();
            }
            if (!bundleVersion) {
                bundleVersion = await promptAppBundleVersion(bundleShortId);
            }
    
            let exists = true;
            if (command.create) {
                exists = await appBundleAliasExists(bundleShortId, bundleAlias);
            }

            let aliasObject = exists
                ? await designAutomation.updateAppBundleAlias(bundleShortId, bundleAlias, parseInt(bundleVersion))
                : await designAutomation.createAppBundleAlias(bundleShortId, bundleAlias, parseInt(bundleVersion));
            if (command.short) {
                log(aliasObject.id);
            } else {
                log(aliasObject);
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('delete-appbundle [bundle-short-id]')
    .alias('db')
    .description('Delete app bundle with all its aliases and versions.')
    .action(async function(bundleShortId, command) {
        try {
            if (!bundleShortId) {
                bundleShortId = await promptAppBundle();
            }
            await designAutomation.deleteAppBundle(bundleShortId);
        } catch(err) {
            error(err);
        }
    });

program
    .command('delete-appbundle-alias [bundle-short-id] [alias]')
    .alias('dba')
    .description('Delete app bundle alias.')
    .action(async function(bundleShortId, alias, command) {
        try {
            if (!bundleShortId) {
                bundleShortId = await promptAppBundle();
            }
            if (!alias) {
                alias = await promptAppBundleAlias(bundleShortId);
            }
            await designAutomation.deleteAppBundleAlias(bundleShortId, alias);
        } catch(err) {
            error(err);
        }
    });

program
    .command('delete-appbundle-version [bundle-short-id] [version]')
    .alias('dbv')
    .description('Delete app bundle version.')
    .action(async function(bundleShortId, version, command) {
        try {
            if (!bundleShortId) {
                bundleShortId = await promptAppBundle();
            }
            if (!version) {
                version = await promptAppBundleVersion(bundleShortId);
            }
            await designAutomation.deleteAppBundleVersion(bundleShortId, parseInt(version));
        } catch(err) {
            error(err);
        }
    });

program
    .command('list-activities')
    .alias('la')
    .description('List activities.')
    .option('-s, --short', 'Output activity IDs instead of the entire JSON.')
    .action(async function(command) {
        try {
            if (command.short) {
                for await (const bundles of designAutomation.iterateActivities()) {
                    bundles.forEach(bundle => log(bundle));
                }
            } else {
                log(await designAutomation.listActivities());
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('get-activity [activity-short-id] [activity-alias]')
    .alias('ga')
    .description('Get activity details.')
    .action(async function(activityShortId, activityAlias, command) {
        try {
            if (!activityShortId) {
                activityShortId = await promptActivity(true);
            }
            if (!activityAlias) {
                activityAlias = await promptActivityAlias(activityShortId);
            }

            const activityId = new DesignAutomationID(designAutomation.auth.client_id, activityShortId, activityAlias);
            const workitem = await designAutomation.getActivity(activityId.toString());
            log(workitem);
        } catch(err) {
            error(err);
        }
    });

let _activityInputs = [];
let _activityOutputs = [];

function _collectActivityInputs(val) {
    _activityInputs.push({ name: val });
}

function _collectActivityInputProps(propName, transform = (val) => val) {
    return function(val) {
        if (_activityInputs.length === 0) {
            throw new Error(`Cannot assign property "${propName}" when no --input was provided. See https://github.com/petrbroz/forge-cli-utils/wiki/Design-Automation-Inputs-and-Outputs.`);
        }
        _activityInputs[_activityInputs.length - 1][propName] = transform(val);
    };
}

function _collectActivityOutputs(val) {
    _activityOutputs.push({ name: val });
}

function _collectActivityOutputProps(propName, transform = (val) => val) {
    return function(val) {
        if (_activityOutputs.length === 0) {
            throw new Error(`Cannot assign property "${propName}" when no --output was provided. See https://github.com/petrbroz/forge-cli-utils/wiki/Design-Automation-Inputs-and-Outputs.`);
        }
        _activityOutputs[_activityOutputs.length - 1][propName] = transform(val);
    };
}

async function activityExists(activityId) {
    const activityIds = await designAutomation.listActivities();
    const match = activityIds.map(decomposeQualifiedID).find(item => item.id === activityId);
    return !!match;
}

program
    .command('create-activity <activity-short-id> [bundle-short-id] [bundle-alias] [engine-full-id]')
    .alias('ca')
    .description('Create new activity.')
    .option('-s, --short', 'Output app bundle ID instead of the entire JSON.')
    .option('-u, --update', 'If activity already exists, update it.')
    .option('-d, --description <description>', 'Optional activity description.')
    .option('--script', 'Optional engine-specific script to pass to activity.')
    .option('-i, --input <name>', 'Activity input ID (can be used multiple times).', _collectActivityInputs)
    .option('-iv, --input-verb <verb>', 'Optional HTTP verb for the last activity input ("get" by default; can be used multiple times).', _collectActivityInputProps('verb'))
    .option('-iz, --input-zip <boolean>', 'Optional zip flag for the last activity input (can be used multiple times).', _collectActivityInputProps('zip', (val) => val.toLowerCase() === 'true'))
    .option('-ir, --input-required <boolean>', 'Optional required flag for the last activity input (can be used multiple times).', _collectActivityInputProps('required', (val) => val.toLowerCase() === 'true'))
    .option('-iod, --input-on-demand', 'Optional ondemand flag for the last activity input (can be used multiple times).', _collectActivityInputProps('ondemand', (val) => val.toLowerCase() === 'true'))
    .option('-id, --input-description <description>', 'Optional description for the last activity input (can be used multiple times).', _collectActivityInputProps('description'))
    .option('-iln, --input-local-name <name>', 'Optional local name for the last activity input (can be used multiple times).', _collectActivityInputProps('localName'))
    .option('-o, --output <name>', 'Activity output ID (can be used multiple times).', _collectActivityOutputs)
    .option('-ov, --output-verb <verb>', 'Optional HTTP verb for the last activity output ("put" by default; can be used multiple times).', _collectActivityOutputProps('verb'))
    .option('-oz, --output-zip <boolean>', 'Optional zip flag for the last activity output (can be used multiple times).', _collectActivityOutputProps('zip', (val) => val.toLowerCase() === 'true'))
    .option('-or, --output-required <boolean>', 'Optional required flag for the last activity output (can be used multiple times).', _collectActivityOutputProps('required', (val) => val.toLowerCase() === 'true'))
    .option('-ood, --output-on-demand', 'Optional ondemand flag for the last activity output (can be used multiple times).', _collectActivityOutputProps('ondemand', (val) => val.toLowerCase() === 'true'))
    .option('-od, --output-description <description>', 'Optional description for the last activity output (can be used multiple times).', _collectActivityOutputProps('description'))
    .option('-oln, --output-local-name <name>', 'Optional local name for the last activity output (can be used multiple times).', _collectActivityOutputProps('localName'))
    .action(async function(activityShortId, bundleShortId, bundleAlias, engineFullId, command) {
        try {
            if (!bundleShortId) {
                bundleShortId = await promptAppBundle();
            }
            if (!bundleAlias) {
                bundleAlias = await promptAppBundleAlias(bundleShortId);
            }
            if (!engineFullId) {
                engineFullId = await promptEngine();
            }
            let description = command.description;
            if (!description) {
                description = `${activityShortId} created via Forge CLI Utils.`;
            }

            let exists = false;
            if (command.update) {
                exists = await activityExists(activityShortId);
            }

            let activity = exists
                ? await designAutomation.updateActivity(activityShortId, description, bundleShortId, bundleAlias, engineFullId, _activityInputs, _activityOutputs, command.script)
                : await designAutomation.createActivity(activityShortId, description, bundleShortId, bundleAlias, engineFullId, _activityInputs, _activityOutputs, command.script);
            if (command.short) {
                log(activity.id);
            } else {
                log(activity);
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('update-activity <activity-short-id> [bundle-short-id] [bundle-alias] [engine-full-id]')
    .alias('ua')
    .description('Update existing activity.')
    .option('-s, --short', 'Output app bundle ID instead of the entire JSON.')
    .option('-c, --create', 'If activity does not exist, create it.')
    .option('-d, --description <description>', 'Optional activity description.')
    .option('--script', 'Optional engine-specific script to pass to activity.')
    .option('-i, --input <name>', 'Activity input ID (can be used multiple times).', _collectActivityInputs)
    .option('-iv, --input-verb <verb>', 'Optional HTTP verb for the last activity input ("get" by default; can be used multiple times).', _collectActivityInputProps('verb'))
    .option('-iz, --input-zip <boolean>', 'Optional zip flag for the last activity input (can be used multiple times).', _collectActivityInputProps('zip', (val) => val.toLowerCase() === 'true'))
    .option('-ir, --input-required <boolean>', 'Optional required flag for the last activity input (can be used multiple times).', _collectActivityInputProps('required', (val) => val.toLowerCase() === 'true'))
    .option('-iod, --input-on-demand', 'Optional ondemand flag for the last activity input (can be used multiple times).', _collectActivityInputProps('ondemand', (val) => val.toLowerCase() === 'true'))
    .option('-id, --input-description <description>', 'Optional description for the last activity input (can be used multiple times).', _collectActivityInputProps('description'))
    .option('-iln, --input-local-name <name>', 'Optional local name for the last activity input (can be used multiple times).', _collectActivityInputProps('localName'))
    .option('-o, --output <name>', 'Activity output ID (can be used multiple times).', _collectActivityOutputs)
    .option('-ov, --output-verb <verb>', 'Optional HTTP verb for the last activity output ("put" by default; can be used multiple times).', _collectActivityOutputProps('verb'))
    .option('-oz, --output-zip <boolean>', 'Optional zip flag for the last activity output (can be used multiple times).', _collectActivityOutputProps('zip', (val) => val.toLowerCase() === 'true'))
    .option('-or, --output-required <boolean>', 'Optional required flag for the last activity output (can be used multiple times).', _collectActivityOutputProps('required', (val) => val.toLowerCase() === 'true'))
    .option('-ood, --output-on-demand', 'Optional ondemand flag for the last activity output (can be used multiple times).', _collectActivityOutputProps('ondemand', (val) => val.toLowerCase() === 'true'))
    .option('-od, --output-description <description>', 'Optional description for the last activity output (can be used multiple times).', _collectActivityOutputProps('description'))
    .option('-oln, --output-local-name <name>', 'Optional local name for the last activity output (can be used multiple times).', _collectActivityOutputProps('localName'))
    .action(async function(activityShortId, bundleShortId, bundleAlias, engineFullId, command) {
        try {
            if (!bundleShortId) {
                bundleShortId = await promptAppBundle();
            }
            if (!bundleAlias) {
                bundleAlias = await promptAppBundleAlias(bundleShortId);
            }
            if (!engineFullId) {
                engineFullId = await promptEngine();
            }
            let description = command.description;
            if (!description) {
                description = `${activityShortId} created via Forge CLI Utils.`;
            }
    
            let exists = true;
            if (command.create) {
                exists = await activityExists(activityShortId);
            }

            let activity = exists
                ? await designAutomation.updateActivity(activityShortId, description, bundleShortId, bundleAlias, engineFullId, _activityInputs, _activityOutputs, command.script)
                : await designAutomation.createActivity(activityShortId, description, bundleShortId, bundleAlias, engineFullId, _activityInputs, _activityOutputs, command.script);
            if (command.short) {
                log(activity.id);
            } else {
                log(activity);
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('list-activity-versions [activity-short-id]')
    .alias('lav')
    .description('List activity versions.')
    .option('-s, --short', 'Output version numbers instead of the entire JSON.')
    .action(async function(activityShortId, command) {
        try {
            if (!activityShortId) {
                activityShortId = await promptActivity();
            }
    
            if (command.short) {
                for await (const versions of designAutomation.iterateActivityVersions(activityShortId)) {
                    versions.forEach(version => log(version));
                }
            } else {
                log(await designAutomation.listActivityVersions(activityShortId));
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('list-activity-aliases [activity-short-id]')
    .alias('laa')
    .description('List activity aliases.')
    .option('-s, --short', 'Output activity aliases instead of the entire JSON.')
    .action(async function(activityShortId, command) {
        try {
            if (!activityShortId) {
                activityShortId = await promptActivity();
            }
    
            if (command.short) {
                for await (const aliases of designAutomation.iterateActivityAliases(activityShortId)) {
                    aliases.forEach(alias => log(alias.id));
                }
            } else {
                log(await designAutomation.listActivityAliases(activityShortId));
            }
        } catch(err) {
            error(err);
        }
    });

async function activityAliasExists(activityShortId, activityAlias) {
    const activityAliases = await designAutomation.listActivityAliases(activityShortId);
    const match = activityAliases.find(item => item.id === activityAlias);
    return !!match;
}

program
    .command('create-activity-alias <activity-alias> [activity-short-id] [activity-version]')
    .alias('caa')
    .description('Create new activity alias.')
    .option('-s, --short', 'Output alias name instead of the entire JSON.')
    .option('-u, --update', 'If activity alias already exists, update it.')
    .action(async function(activityAlias, activityShortId, activityVersion, command) {
        try {
            if (!activityShortId) {
                activityShortId = await promptActivity();
            }
            if (!activityVersion) {
                activityVersion = await promptActivityVersion(activityShortId);
            }
    
            let exists = false;
            if (command.update) {
                exists = await activityAliasExists(activityShortId, activityAlias);
            }

            let aliasObject = exists
                ? await designAutomation.updateActivityAlias(activityShortId, activityAlias, parseInt(activityVersion))
                : await designAutomation.createActivityAlias(activityShortId, activityAlias, parseInt(activityVersion));
            if (command.short) {
                log(aliasObject.id);
            } else {
                log(aliasObject);
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('update-activity-alias <activity-alias> [activity-short-id] [activity-version]')
    .alias('uaa')
    .description('Update existing activity alias.')
    .option('-s, --short', 'Output alias name instead of the entire JSON.')
    .option('-c, --create', 'If activity alias does not exist, create it.')
    .action(async function(activityAlias, activityShortId, activityVersion, command) {
        try {
            if (!activityShortId) {
                activityShortId = await promptActivity();
            }
            if (!activityVersion) {
                activityVersion = await promptActivityVersion(activityShortId);
            }
    
            let exists = true;
            if (command.create) {
                exists = await activityAliasExists(activityShortId, activityAlias);
            }

            let aliasObject = exists
                ? await designAutomation.updateActivityAlias(activityShortId, activityAlias, parseInt(activityVersion))
                : await designAutomation.createActivityAlias(activityShortId, activityAlias, parseInt(activityVersion));
            if (command.short) {
                log(aliasObject.id);
            } else {
                log(aliasObject);
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('delete-activity [activity-short-id]')
    .alias('da')
    .description('Delete activity with all its aliases and versions.')
    .action(async function(activityShortId, command) {
        try {
            if (!activityShortId) {
                activityShortId = await promptActivity();
            }
            await designAutomation.deleteActivity(activityShortId);
        } catch(err) {
            error(err);
        }
    });

program
    .command('delete-activity-alias [activity-short-id] [alias]')
    .alias('daa')
    .description('Delete activity alias.')
    .action(async function(activityShortId, alias, command) {
        try {
            if (!activityShortId) {
                activityShortId = await promptActivity();
            }
            if (!alias) {
                alias = await promptActivityAlias(activityShortId);
            }
            await designAutomation.deleteActivityAlias(activityShortId, alias);
        } catch(err) {
            error(err);
        }
    });

program
    .command('delete-activity-version [activity-short-id] [version]')
    .alias('dav')
    .description('Delete activity version.')
    .action(async function(activityShortId, version, command) {
        try {
            if (!activityShortId) {
                activityShortId = await promptActivity();
            }
            if (!version) {
                version = await promptActivityVersion(activityShortId);
            }
            await designAutomation.deleteActivityVersion(activityShortId, parseInt(version));
        } catch(err) {
            error(err);
        }
    });

let _workitemInputs = [];
let _workitemOutputs = [];

function _collectWorkitemInputs(val) {
    _workitemInputs.push({ name: val });
}

function _collectWorkitemInputProps(propName, transform = (val) => val) {
    return function(val) {
        if (_workitemInputs.length === 0) {
            throw new Error(`Cannot assign property "${propName}" when no --input was provided. See https://github.com/petrbroz/forge-cli-utils/wiki/Design-Automation-Inputs-and-Outputs.`);
        }
        _workitemInputs[_workitemInputs.length - 1][propName] = transform(val);
    };
}

function _collectWorkitemInputHeaders(val) {
    if (_workitemInputs.length === 0) {
        throw new Error('Cannot assign header property when no --input was provided. See https://github.com/petrbroz/forge-cli-utils/wiki/Design-Automation-Inputs-and-Outputs.');
    }
    if (!_workitemInputs[_workitemInputs.length - 1].headers) {
        _workitemInputs[_workitemInputs.length - 1].headers = {};
    }
    const tokens = val.split(':');
    const name = tokens[0].trim();
    const value = tokens[1].trim();
    _workitemInputs[_workitemInputs.length - 1].headers[name] = value;
}

function _collectWorkitemOutputs(val) {
    _workitemOutputs.push({ name: val });
}

function _collectWorkitemOutputProps(propName, transform = (val) => val) {
    return function(val) {
        if (_workitemOutputs.length === 0) {
            throw new Error(`Cannot assign property "${propName}" when no --output was provided. See https://github.com/petrbroz/forge-cli-utils/wiki/Design-Automation-Inputs-and-Outputs.`);
        }
        _workitemOutputs[_workitemOutputs.length - 1][propName] = transform(val);
    };
}

function _collectWorkitemOutputHeaders(val) {
    if (_workitemOutputs.length === 0) {
        throw new Error('Cannot assign header property when no --output was provided. See https://github.com/petrbroz/forge-cli-utils/wiki/Design-Automation-Inputs-and-Outputs.');
    }
    if (!_workitemOutputs[_workitemOutputs.length - 1].headers) {
        _workitemOutputs[_workitemOutputs.length - 1].headers = {};
    }
    const tokens = val.split(':');
    const name = tokens[0].trim();
    const value = tokens[1].trim();
    _workitemOutputs[_workitemOutputs.length - 1].headers[name] = value;
}

program
    .command('create-workitem [activity-short-id] [activity-alias]')
    .alias('cw')
    .description('Create new work item.')
    .option('-s, --short', 'Output work item ID instead of the entire JSON.')
    .option('-i, --input <name>', 'Work item input ID (can be used multiple times).', _collectWorkitemInputs)
    .option('-iu, --input-url <name>', 'URL of the last work item input (can be used multiple times).', _collectWorkitemInputProps('url'))
    .option('-iln, --input-local-name <name>', 'Optional local name of the last work item input (can be used multiple times).', _collectWorkitemInputProps('localName'))
    .option('-ih, --input-header <name:value>', 'Optional HTTP request header for the last work item input (can be used multiple times).', _collectWorkitemInputHeaders)
    .option('-o, --output <name>', 'Work item output ID (can be used multiple times).', _collectWorkitemOutputs)
    .option('-ou, --output-url <name>', 'URL of the last work item output (can be used multiple times).', _collectWorkitemOutputProps('url'))
    .option('-oln, --output-local-name <name>', 'Optional local name of the last work item output (can be used multiple times).', _collectWorkitemOutputProps('localName'))
    .option('-oh, --output-header <name:value>', 'Optional HTTP request header for the last work item output (can be used multiple times).', _collectWorkitemOutputHeaders)
    .action(async function(activityShortId, activityAlias, command) {
        try {
            if (!activityShortId) {
                activityShortId = await promptActivity(false);
            }
            if (!activityAlias) {
                activityAlias = await promptActivityAlias(activityShortId);
            }

            const activityId = new DesignAutomationID(designAutomation.auth.client_id, activityShortId, activityAlias);
            const workitem = await designAutomation.createWorkItem(activityId.toString(), _workitemInputs, _workitemOutputs);
            if (command.short) {
                log(workitem.id);
            } else {
                log(workitem);
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('get-workitem <workitem-id>')
    .alias('gw')
    .description('Get work item details.')
    .option('-s, --short', 'Output work item status instead of the entire JSON.')
    .action(async function(workitemId, command) {
        try {
            const workitem = await designAutomation.workItemDetails(workitemId);
            if (command.short) {
                log(workitem.status);
            } else {
                log(workitem);
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('delete-workitem <workitem-id>')
    .alias('dw')
    .description('Delete work item.')
    .action(async function(workitemId, command) {
        try {
            await designAutomation.deleteWorkItem(workitemId);
        } catch(err) {
            error(err);
        }
    });

program.parse(process.argv);
if (!program.args.length) {
    program.help();
}
