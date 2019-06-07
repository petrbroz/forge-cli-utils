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
    .command('get-engine [engine]')
    .alias('ge')
    .description('Get engine details.')
    .action(async function(engineid, command) {
        try {
            if (!engineid) {
                engineid = await promptEngine();
            }

            const engine = await designAutomation.getEngine(engineid);
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
    .command('get-appbundle [bundle] [bundlealias]')
    .alias('gb')
    .description('Get appbundle details.')
    .action(async function(bundle, bundlealias, command) {
        try {
            if (!bundle) {
                bundle = await promptAppBundle();
                if (isQualifiedID(bundle)) {
                    bundle = decomposeQualifiedID(bundle).id;
                }
            }
            if (!bundlealias) {
                bundlealias = await promptAppBundleAlias(bundle);
            }

            const bundleId = designAutomation.auth.client_id + '.' + bundle + '+' + bundlealias;
            const appbundle = await designAutomation.getAppBundle(bundleId);
            log(appbundle);
        } catch(err) {
            error(err);
        }
    });

async function appBundleExists(appBundleId) {
    const appBundleIDs = await designAutomation.listAppBundles();
    const match = appBundleIDs.map(decomposeQualifiedID).find(item => item.id === appBundleId);
    return match !== null;
}

program
    .command('create-appbundle <name> <filename> [engine] [description]')
    .alias('cb')
    .description('Create new app bundle.')
    .option('-s, --short', 'Output app bundle ID instead of the entire JSON.')
    .option('-u, --update', 'If app bundle already exists, update it.')
    .action(async function(name, filename, engine, description, command) {
        try {
            if (!engine) {
                engine = await promptEngine();
            }
            if (!description) {
                description = `${name} created via Forge CLI Utils.`;
            }
    
            let exists = false;
            if (command.update) {
                exists = await appBundleExists(name);
            }

            let appBundle = exists
                ? await designAutomation.updateAppBundle(name, engine, description)
                : await designAutomation.createAppBundle(name, engine, description);
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
    .command('update-appbundle <appbundle> <filename> [engine] [description]')
    .alias('ub')
    .description('Update existing app bundle.')
    .option('-s, --short', 'Output app bundle ID instead of the entire JSON.')
    .option('-c, --create', 'If app bundle does not exists, create it.')
    .action(async function(appbundle, filename, engine, description, command) {
        try {
            let exists = true;
            if (command.create) {
                exists = await appBundleExists(appbundle);
            }

            let appBundle = exists
                ? await designAutomation.updateAppBundle(appbundle, engine, description)
                : await designAutomation.createAppBundle(appbundle, engine, description);
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
    .command('list-appbundle-versions [appbundle]')
    .alias('lbv')
    .description('List app bundle versions.')
    .option('-s, --short', 'Output version numbers instead of the entire JSON.')
    .action(async function(appbundle, command) {
        try {
            if (!appbundle) {
                appbundle = await promptAppBundle();
            }
    
            if (command.short) {
                for await (const versions of designAutomation.iterateAppBundleVersions(appbundle)) {
                    versions.forEach(version => log(version));
                }
            } else {
                log(await designAutomation.listAppBundleVersions(appbundle));
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('list-appbundle-aliases [appbundle]')
    .alias('lba')
    .description('List app bundle aliases.')
    .option('-s, --short', 'Output app bundle aliases instead of the entire JSON.')
    .action(async function(appbundle, command) {
        try {
            if (!appbundle) {
                appbundle = await promptAppBundle();
            }
    
            if (command.short) {
                for await (const aliases of designAutomation.iterateAppBundleAliases(appbundle)) {
                    aliases.forEach(alias => log(alias.id));
                }
            } else {
                log(await designAutomation.listAppBundleAliases(appbundle));
            }
        } catch(err) {
            error(err);
        }
    });

async function appBundleAliasExists(appBundleId, aliasId) {
    const appBundleAliases = await designAutomation.listAppBundleAliases(appBundleId);
    const match = appBundleAliases.find(item => item.id === aliasId);
    return match !== null;
}

program
    .command('create-appbundle-alias <alias> [appbundle] [version]')
    .alias('cba')
    .description('Create new app bundle alias.')
    .option('-s, --short', 'Output alias name instead of the entire JSON.')
    .option('-u, --update', 'If app bundle alias exists, update it.')
    .action(async function(alias, appbundle, version, command) {
        try {
            if (!appbundle) {
                appbundle = await promptAppBundle();
            }
            if (!version) {
                version = await promptAppBundleVersion(appbundle);
            }
    
            let exists = false;
            if (command.update) {
                exists = await appBundleAliasExists(appbundle, alias);
            }

            let aliasObject = exists
                ? await designAutomation.updateAppBundleAlias(appbundle, alias, parseInt(version))
                : await designAutomation.createAppBundleAlias(appbundle, alias, parseInt(version));
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
    .command('update-appbundle-alias <alias> [appbundle] [version]')
    .alias('uba')
    .description('Update existing app bundle alias.')
    .option('-s, --short', 'Output alias name instead of the entire JSON.')
    .option('-c, --create', 'If app bundle alias does not exist, create it.')
    .action(async function(alias, appbundle, version, command) {
        try {
            if (!appbundle) {
                appbundle = await promptAppBundle();
            }
            if (!version) {
                version = await promptAppBundleVersion(appbundle);
            }
    
            let exists = true;
            if (command.create) {
                exists = await appBundleAliasExists(appbundle, alias);
            }

            let aliasObject = exists
                ? await designAutomation.updateAppBundleAlias(appbundle, alias, parseInt(version))
                : await designAutomation.createAppBundleAlias(appbundle, alias, parseInt(version));
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
    .command('get-activity [activity] [activityalias]')
    .alias('ga')
    .description('Get activity details.')
    .action(async function(activity, activityalias, command) {
        try {
            if (!activity) {
                activity = await promptActivity(false);
                if (isQualifiedID(activity)) {
                    activity = decomposeQualifiedID(activity).id;
                }
            }
            if (!activityalias) {
                activityalias = await promptActivityAlias(activity);
            }

            const activityId = designAutomation.auth.client_id + '.' + activity + '+' + activityalias;
            const workitem = await designAutomation.getActivity(activityId);
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

program
    .command('create-activity <name> [bundle] [bundlealias] [engine]')
    .alias('ca')
    .description('Create new activity.')
    .option('-s, --short', 'Output app bundle ID instead of the entire JSON.')
    .option('-d, --description <description>', 'Optional activity description.')
    .option('--script', 'Optional engine-specific script to pass to activity.')
    .option('-i, --input <name>', 'Activity input ID (can be used multiple times).', _collectActivityInputs)
    .option('-iz, --input-zip <boolean>', 'Optional zip flag for the last activity input (can be used multiple times).', _collectActivityInputProps('zip', (val) => val.toLowerCase() === 'true'))
    .option('-ir, --input-required <boolean>', 'Optional required flag for the last activity input (can be used multiple times).', _collectActivityInputProps('required', (val) => val.toLowerCase() === 'true'))
    .option('-id, --input-description <description>', 'Optional description for the last activity input (can be used multiple times).', _collectActivityInputProps('description'))
    .option('-iln, --input-local-name <name>', 'Optional local name for the last activity input (can be used multiple times).', _collectActivityInputProps('localName'))
    .option('-o, --output <name>', 'Activity output ID (can be used multiple times).', _collectActivityOutputs)
    .option('-oz, --output-zip <boolean>', 'Optional zip flag for the last activity output (can be used multiple times).', _collectActivityOutputProps('zip', (val) => val.toLowerCase() === 'true'))
    .option('-or, --output-required <boolean>', 'Optional required flag for the last activity output (can be used multiple times).', _collectActivityOutputProps('required', (val) => val.toLowerCase() === 'true'))
    .option('-od, --output-description <description>', 'Optional description for the last activity output (can be used multiple times).', _collectActivityOutputProps('description'))
    .option('-oln, --output-local-name <name>', 'Optional local name for the last activity output (can be used multiple times).', _collectActivityOutputProps('localName'))
    .action(async function(name, bundle, bundlealias, engine, command) {
        try {
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

            console.log(_activityInputs);
            console.log(_activityOutputs);
            return;

            let activity = await designAutomation.createActivity(name, description, bundle, bundlealias, engine, _activityInputs, _activityOutputs, command.script);
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
    .command('update-activity <name> [bundle] [bundlealias] [engine]')
    .alias('ua')
    .description('Update existing activity.')
    .option('-s, --short', 'Output app bundle ID instead of the entire JSON.')
    .option('-d, --description <description>', 'Optional activity description.')
    .option('--script', 'Optional engine-specific script to pass to activity.')
    .option('-i, --input <name>', 'Activity input ID (can be used multiple times).', _collectActivityInputs)
    .option('-iz, --input-zip <boolean>', 'Optional zip flag for the last activity input (can be used multiple times).', _collectActivityInputProps('zip', (val) => val.toLowerCase() === 'true'))
    .option('-ir, --input-required <boolean>', 'Optional required flag for the last activity input (can be used multiple times).', _collectActivityInputProps('required', (val) => val.toLowerCase() === 'true'))
    .option('-id, --input-description <description>', 'Optional description for the last activity input (can be used multiple times).', _collectActivityInputProps('description'))
    .option('-iln, --input-local-name <name>', 'Optional local name for the last activity input (can be used multiple times).', _collectActivityInputProps('localName'))
    .option('-o, --output <name>', 'Activity output ID (can be used multiple times).', _collectActivityOutputs)
    .option('-oz, --output-zip <boolean>', 'Optional zip flag for the last activity output (can be used multiple times).', _collectActivityOutputProps('zip', (val) => val.toLowerCase() === 'true'))
    .option('-or, --output-required <boolean>', 'Optional required flag for the last activity output (can be used multiple times).', _collectActivityOutputProps('required', (val) => val.toLowerCase() === 'true'))
    .option('-od, --output-description <description>', 'Optional description for the last activity output (can be used multiple times).', _collectActivityOutputProps('description'))
    .option('-oln, --output-local-name <name>', 'Optional local name for the last activity output (can be used multiple times).', _collectActivityOutputProps('localName'))
    .action(async function(name, bundle, bundlealias, engine, command) {
        try {
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
    
            let activity = await designAutomation.updateActivity(name, description, bundle, bundlealias, engine, _activityInputs, _activityOutputs, command.script);
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
    .command('list-activity-versions [activity]')
    .alias('lav')
    .description('List activity versions.')
    .option('-s, --short', 'Output version numbers instead of the entire JSON.')
    .action(async function(activity, command) {
        try {
            if (!activity) {
                activity = await promptActivity();
            }
    
            if (command.short) {
                for await (const versions of designAutomation.iterateActivityVersions(activity)) {
                    versions.forEach(version => log(version));
                }
            } else {
                log(await designAutomation.listActivityVersions(activity));
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('list-activity-aliases [activity]')
    .alias('laa')
    .description('List activity aliases.')
    .option('-s, --short', 'Output activity aliases instead of the entire JSON.')
    .action(async function(activity, command) {
        try {
            if (!activity) {
                activity = await promptActivity();
            }
    
            if (command.short) {
                for await (const aliases of designAutomation.iterateActivityAliases(activity)) {
                    aliases.forEach(alias => log(alias.id));
                }
            } else {
                log(await designAutomation.listActivityAliases(activity));
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('create-activity-alias <alias> [activity] [version]')
    .alias('caa')
    .description('Create new activity alias.')
    .option('-s, --short', 'Output alias name instead of the entire JSON.')
    .action(async function(alias, activity, version, command) {
        try {
            if (!activity) {
                activity = await promptActivity();
            }
            if (!version) {
                version = await promptActivityVersion(activity);
            }
    
            let aliasObject = await designAutomation.createActivityAlias(activity, alias, parseInt(version));
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
    .command('update-activity-alias <alias> [activity] [version]')
    .alias('uaa')
    .description('Update existing activity alias.')
    .option('-s, --short', 'Output alias name instead of the entire JSON.')
    .action(async function(alias, activity, version, command) {
        try {
            if (!activity) {
                activity = await promptActivity();
            }
            if (!version) {
                version = await promptActivityVersion(activity);
            }
    
            let aliasObject = await designAutomation.updateActivityAlias(activity, alias, parseInt(version));
            if (command.short) {
                log(aliasObject.id);
            } else {
                log(aliasObject);
            }
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
    .command('create-workitem [activity] [activityalias]')
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
    .action(async function(activity, activityalias, command) {
        try {
            if (!activity) {
                activity = await promptActivity(false);
            }
            if (!activityalias) {
                activityalias = await promptActivityAlias(activity);
            }

            const activityId = designAutomation.auth.client_id + '.' + activity + '+' + activityalias;
            const workitem = await designAutomation.createWorkItem(activityId, _workitemInputs, _workitemOutputs);
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
    .command('get-workitem <id>')
    .alias('cw')
    .description('Get work item details.')
    .option('-s, --short', 'Output work item status instead of the entire JSON.')
    .action(async function(id, command) {
        try {
            const workitem = await designAutomation.workItemDetails(id);
            if (command.short) {
                log(workitem.status);
            } else {
                log(workitem);
            }
        } catch(err) {
            error(err);
        }
    });

program.parse(process.argv);
if (!program.args.length) {
    program.help();
}
