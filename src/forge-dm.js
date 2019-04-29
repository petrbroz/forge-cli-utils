#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

const program = require('commander');
const { prompt } = require('inquirer');

const { AuthenticationClient, DataManagementClient } = require('forge-nodejs-utils');

const { FORGE_CLIENT_ID, FORGE_CLIENT_SECRET } = process.env;
if (!FORGE_CLIENT_ID || !FORGE_CLIENT_SECRET) {
    console.warn('Provide FORGE_CLIENT_ID and FORGE_CLIENT_SECRET as env. variables.');
    return;
}
const auth = new AuthenticationClient(FORGE_CLIENT_ID, FORGE_CLIENT_SECRET);
const data = new DataManagementClient(auth);

async function promptBucket() {
    const buckets = await data.listBuckets();
    const answer = await prompt({ type: 'list', name: 'bucket', choices: buckets.map(bucket => bucket.bucketKey) });
    return answer.bucket;
}

async function promptObject(bucket) {
    const objects = await data.listObjects(bucket);
    const answer = await prompt({ type: 'list', name: 'object', choices: objects.map(object => object.objectKey) });
    return answer.object;
}

program
    .version('0.2.0')
    .description('Command-line tool for accessing Autodesk Forge Data Management service.');

program
    .command('list-buckets')
    .alias('lb')
    .description('List buckets.')
    .option('-s, --short', 'Output bucket keys instead of the entire JSON.')
    .action(async function(command) {
        if (command.short) {
            for await (const buckets of data.iterateBuckets()) {
                buckets.forEach(bucket => console.log(bucket.bucketKey));
            }
        } else {
            console.log(await data.listBuckets());
        }
    });

program
    .command('bucket-details [bucket]')
    .alias('bd')
    .description('Retrieve bucket details.')
    .action(async function(bucket) {
        if (!bucket) {
            bucket = await promptBucket();
        }

        const details = await data.getBucketDetails(bucket);
        console.log(details);
    });

program
    .command('create-bucket <bucket>')
    .alias('cb')
    .description('Create new bucket.')
    .option('-r, --retention <policy>', 'Data retention policy. One of "transient" (default), "temporary", or "permanent".')
    .action(async function(bucket, command) {
        const retention = command.retention || 'transient';
        const response = await data.createBucket(bucket, retention);
        console.log(response);
    });

program
    .command('list-objects [bucket]')
    .alias('lo')
    .description('List objects in bucket.')
    .option('-s, --short', 'Output object IDs instead of the entire JSON.')
    .action(async function(bucket, command) {
        if (!bucket) {
            bucket = await promptBucket();
        }

        if (command.short) {
            for await (const objects of data.iterateObjects(bucket)) {
                objects.forEach(object => console.log(object.objectId));
            }
        } else {
            console.log(await data.listObjects(bucket));
        }
    });

program
    .command('upload-object <filename> <content-type> [bucket] [name]')
    .alias('uo')
    .description('Upload file to bucket.')
    .option('-s, --short', 'Output object ID instead of the entire JSON.')
    .action(async function(filename, contentType, bucket, name, command) {
        if (!bucket) {
            bucket = await promptBucket();
        }

        if (!name) {
            const answer = await prompt({ type: 'input', name: 'name', default: path.basename(filename) });
            name = answer.name;
        }

        const buffer = fs.readFileSync(filename);
        // TODO: add support for passing in a readable stream instead of reading entire file into memory
        const uploaded = await data.uploadObject(bucket, name, contentType,  buffer);
        console.log(command.short ? uploaded.objectId : uploaded);
    });

program
    .command('download-object [bucket] [object] [filename]')
    .alias('do')
    .description('Download file from bucket.')
    .action(async function(bucket, object, filename, command) {
        if (!bucket) {
            bucket = await promptBucket();
        }
        if (!object) {
            object = await promptObject(bucket);
        }
        if (!filename) {
            filename = object;
        }

        const buffer = await data.downloadObject(bucket, object);
        // TODO: add support for streaming data directly to disk instead of getting entire file into memory first
        fs.writeFileSync(filename, buffer);
    });

program.parse(process.argv);
