#!/bin/env node

const fs = require('fs');
const { DataManagementClient, DesignAutomationClient } = require('forge-nodejs-utils');

const BUCKET = process.env.FORGE_BUCKET;

const ACTIVITY_NAME = 'TestActivity';
const ACTIVITY_ALIAS = 'dev';

const INPUT_FILE_PATH = './Clutch_Gear_20t.ipt';
const INPUT_OBJECT_KEY = 'input.ipt';
const THUMBNAIL_OBJECT_KEY = 'thumbnail.bmp';

let credentials = {
    client_id: process.env.FORGE_CLIENT_ID,
    client_secret: process.env.FORGE_CLIENT_SECRET
};
let dm = new DataManagementClient(credentials);
let da = new DesignAutomationClient(credentials);

function sleep(ms) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() { resolve(); }, ms);
    });
}

async function run() {
    // Create bucket if it doesn't exist
    const allBuckets = await dm.listBuckets();
    const matchingBuckets = allBuckets.filter(item => item.bucketKey === BUCKET);
    if (matchingBuckets.length === 0) {
        try {
            await dm.createBucket(BUCKET, 'persistent');
        } catch(err) {
            console.error('Could not create bucket', err);
            process.exit(1);
        }
    }

    // Upload Inventor file and create a placeholder for the output thumbnail
    const inputObjectBuff = fs.readFileSync(INPUT_FILE_PATH);
    try {
        await dm.uploadObject(BUCKET, INPUT_OBJECT_KEY, 'application/octet-stream', inputObjectBuff);
    } catch(err) {
        console.error('Could not upload input file', err);
        process.exit(1);
    }

    // Generate signed URLs for all input and output files
    let inputFileSignedUrl;
    let thumbnailSignedUrl;
    try {
        inputFileSignedUrl = await dm.createSignedUrl(BUCKET, INPUT_OBJECT_KEY, 'read');
        thumbnailSignedUrl = await dm.createSignedUrl(BUCKET, THUMBNAIL_OBJECT_KEY, 'readwrite');
    } catch(err) {
        console.error('Could not generate signed URLs', err);
        process.exit(1);
    }

    // Create work item and poll the results
    const activityId = credentials.client_id + '.' + ACTIVITY_NAME + '+' + ACTIVITY_ALIAS;
    const workitemInputs = [
        { name: 'PartFile', url: inputFileSignedUrl.signedUrl }
    ];
    const workitemOutputs = [
        { name: 'Thumbnail', url: thumbnailSignedUrl.signedUrl }
    ];
    let workitem;
    try {
        workitem = await da.createWorkItem(activityId, workitemInputs, workitemOutputs);
        console.log('Workitem', workitem);
        while (workitem.status === 'inprogress' || workitem.status === 'pending') {
            await sleep(5000);
            workitem = await da.workItemDetails(workitem.id);
            console.log(workitem.status);
        }
    } catch(err) {
        console.error('Could not run work item', err);
        process.exit(1);
    }

    console.log('Results', workitem);
    console.log('Result thumbnail url:', thumbnailSignedUrl.signedUrl);
}

run();
