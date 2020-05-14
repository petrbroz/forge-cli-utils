#!/bin/env node

const fs = require('fs');
const FormData = require('form-data');
const { DataManagementClient, DesignAutomationClient } = require('forge-server-utils');

const APPBUNDLE_NAME = 'TestBundle';
const APPBUNDLE_DESCRIPTIION = 'TestBundle description';
const APPBUNDLE_ALIAS = 'dev';
const APPBUNDLE_FILE = './ThumbnailPlugin.bundle.zip';
const APPBUNDLE_ENGINE = 'Autodesk.Inventor+24';

const ACTIVITY_NAME = 'TestActivity';
const ACTIVITY_DESCRIPTION = 'Activity description';
const ACTIVITY_ALIAS = 'dev';

let credentials = {
    client_id: process.env.FORGE_CLIENT_ID,
    client_secret: process.env.FORGE_CLIENT_SECRET
};
let dm = new DataManagementClient(credentials);
let da = new DesignAutomationClient(credentials);

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

async function setup() {
    // Create or update an appbundle
    const allAppBundles = await da.listAppBundles();
    const matchingAppBundles = allAppBundles.filter(item => item.indexOf(APPBUNDLE_NAME) !== -1);
    let appBundle;
    try {
        if (matchingAppBundles.length === 0) {
            appBundle = await da.createAppBundle(APPBUNDLE_NAME, APPBUNDLE_ENGINE, APPBUNDLE_DESCRIPTIION);
        } else {
            appBundle = await da.updateAppBundle(APPBUNDLE_NAME, APPBUNDLE_ENGINE, APPBUNDLE_DESCRIPTIION);
        }
    } catch(err) {
        console.error('Could not create or update appbundle', err);
        process.exit(1);
    }
    console.log('AppBundle', appBundle);

    // Upload appbundle zip file
    try {
        await uploadAppBundleFile(appBundle, APPBUNDLE_FILE);
    } catch(err) {
        console.error('Could not upload appbundle file', err);
        process.exit(1);
    }

    // Create or update an appbundle alias
    const allAppBundleAliases = await da.listAppBundleAliases(APPBUNDLE_NAME);
    const matchingAppBundleAliases = allAppBundleAliases.filter(item => item.id === APPBUNDLE_ALIAS);
    let appBundleAlias;
    try {
        if (matchingAppBundleAliases.length === 0) {
            appBundleAlias = await da.createAppBundleAlias(APPBUNDLE_NAME, APPBUNDLE_ALIAS, appBundle.version);
        } else {
            appBundleAlias = await da.updateAppBundleAlias(APPBUNDLE_NAME, APPBUNDLE_ALIAS, appBundle.version);
        }
    } catch(err) {
        console.error('Could not create or update appbundle alias', err);
        process.exit(1);
    }
    console.log('AppBundle alias', appBundleAlias);

    // Create or update an activity
    const allActivities = await da.listActivities();
    const matchingActivities = allActivities.filter(item => item.indexOf('.' + ACTIVITY_NAME + '+') !== -1);
    const activityInputs = [
        { name: 'PartFile', description: 'Input Inventor part file.' }
    ];
    const activityOutputs = [
        { name: 'Thumbnail', description: 'Output thumbnail bitmap file.', localName: 'thumbnail.bmp' }
    ];
    let activity;
    try {
        if (matchingActivities.length === 0) {
            activity = await da.createActivity(ACTIVITY_NAME, ACTIVITY_DESCRIPTION, APPBUNDLE_NAME, APPBUNDLE_ALIAS, APPBUNDLE_ENGINE, activityInputs, activityOutputs);
        } else {
            activity = await da.updateActivity(ACTIVITY_NAME, ACTIVITY_DESCRIPTION, APPBUNDLE_NAME, APPBUNDLE_ALIAS, APPBUNDLE_ENGINE, activityInputs, activityOutputs);
        }
    } catch(err) {
        console.error('Could not create or update activity', err);
        process.exit(1);
    }
    console.log('Activity', activity);

    // Create or update an activity alias
    const allActivityAliases = await da.listActivityAliases(ACTIVITY_NAME);
    const matchingActivityAliases = allActivityAliases.filter(item => item.id === ACTIVITY_ALIAS);
    let activityAlias;
    try {
        if (matchingActivityAliases.length === 0) {
            activityAlias = await da.createActivityAlias(ACTIVITY_NAME, ACTIVITY_ALIAS, activity.version);
        } else {
            activityAlias = await da.updateActivityAlias(ACTIVITY_NAME, ACTIVITY_ALIAS, activity.version);
        }
    } catch(err) {
        console.error('Could not create or update activity alias', err);
        process.exit(1);
    }
    console.log('Activity alias', activityAlias);
}

setup();
