#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const program = require('commander');
const { prompt } = require('inquirer');
const { DataManagementClient } = require('forge-nodejs-utils');

const package = require('../package.json');
const { log, warn, error } = require('./common');

const { FORGE_CLIENT_ID, FORGE_CLIENT_SECRET } = process.env;
if (!FORGE_CLIENT_ID || !FORGE_CLIENT_SECRET) {
    warn('Provide FORGE_CLIENT_ID and FORGE_CLIENT_SECRET as env. variables.');
    return;
}
const data = new DataManagementClient({ client_id: FORGE_CLIENT_ID, client_secret: FORGE_CLIENT_SECRET });

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

function computeFileHash(filename) {
    return new Promise(function(resolve, reject) {
        const stream = fs.createReadStream(filename);
        let hash = crypto.createHash('md5');
        stream.on('data', function(chunk) {
            hash.update(chunk);
        });
        stream.on('end', function() {
            resolve(hash.digest('hex'));
        });
        stream.on('error', function(err) {
            reject(err);
        });
    });
}

program
    .version(package.version)
    .description('Command-line tool for accessing Autodesk Forge Data Management service.');

program
    .command('list-buckets')
    .alias('lb')
    .description('List buckets.')
    .option('-s, --short', 'Output bucket keys instead of the entire JSON.')
    .action(async function(command) {
        try {
            if (command.short) {
                for await (const buckets of data.iterateBuckets()) {
                    buckets.forEach(bucket => log(bucket.bucketKey));
                }
            } else {
                log(await data.listBuckets());
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('bucket-details [bucket]')
    .alias('bd')
    .description('Retrieve bucket details.')
    .action(async function(bucket) {
        try {
            if (!bucket) {
                bucket = await promptBucket();
            }
    
            const details = await data.getBucketDetails(bucket);
            log(details);
        } catch(err) {
            error(err);
        }
    });

program
    .command('create-bucket <bucket>')
    .alias('cb')
    .description('Create new bucket.')
    .option('-r, --retention <policy>', 'Data retention policy. One of "transient" (default), "temporary", or "permanent".')
    .action(async function(bucket, command) {
        try {
            const retention = command.retention || 'transient';
            const response = await data.createBucket(bucket, retention);
            log(response);
        } catch(err) {
            error(err);
        }
    });

program
    .command('list-objects [bucket]')
    .alias('lo')
    .description('List objects in bucket.')
    .option('-s, --short', 'Output object IDs instead of the entire JSON.')
    .action(async function(bucket, command) {
        try {
            if (!bucket) {
                bucket = await promptBucket();
            }
    
            if (command.short) {
                for await (const objects of data.iterateObjects(bucket)) {
                    objects.forEach(object => log(object.objectId));
                }
            } else {
                log(await data.listObjects(bucket));
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('upload-object <filename> <content-type> [bucket] [name]')
    .alias('uo')
    .description('Upload file to bucket.')
    .option('-s, --short', 'Output object ID instead of the entire JSON.')
    .option('-r, --resumable', 'Upload file in chunks using the resumable capabilities. If the upload is interrupted or fails, simply run the command again to continue.')
    .option('-rp, --resumable-page <megabytes>', 'Optional max. size of each chunk during resumable upload (in MB; must be greater or equal to 2; by default 5).', 5)
    .option('-rs, --resumable-session <value>', 'Optional session ID during the resumable upload (if omitted, an MD5 hash of the file content is used).')
    .action(async function(filename, contentType, bucket, name, command) {
        try {
            if (!bucket) {
                bucket = await promptBucket();
            }
    
            if (!name) {
                const answer = await prompt({ type: 'input', name: 'name', default: path.basename(filename) });
                name = answer.name;
            }

            if (command.resumable) {
                /*
                 * If the --resumable option is used, collect the list of ranges of data that has already been
                 * uploaded in a specific session (either an MD5 hash of the file contents or a custom ID),
                 * and start uploading missing chunks.
                 */
                const sessionId = command.resumableSession || (await computeFileHash(filename));
                let ranges = null;
                try {
                    ranges = await data.getResumableUploadStatus(bucket, name, sessionId);
                    console.log('ranges', ranges);
                } catch(err) {
                    ranges = [];
                }

                const maxChunkSize = command.resumablePage << 20;
                const totalFileSize = fs.statSync(filename).size;
                let lastByte = 0;
                let fd = fs.openSync(filename, 'r');
                let buff = Buffer.alloc(maxChunkSize);
                // Upload potential missing data before each successfully uploaded range
                for (const range of ranges) {
                    while (lastByte < range.start) {
                        const chunkSize = Math.min(range.start - lastByte, maxChunkSize);
                        fs.readSync(fd, buff, 0, chunkSize, lastByte);
                        await data.uploadObjectResumable(bucket, name, buff.slice(0, chunkSize), lastByte, totalFileSize, sessionId, contentType);
                        lastByte += chunkSize;
                    }
                    lastByte = range.end + 1;
                }
                // Upload potential missing data after the last successfully uploaded range
                while (lastByte < totalFileSize - 1) {
                    const chunkSize = Math.min(totalFileSize - lastByte, maxChunkSize);
                    fs.readSync(fd, buff, 0, chunkSize, lastByte);
                    await data.uploadObjectResumable(bucket, name, buff.slice(0, chunkSize), lastByte, totalFileSize, sessionId, contentType);
                    lastByte += chunkSize;
                }
                fs.closeSync(fd);
            } else {
                const buffer = fs.readFileSync(filename);
                const uploaded = await data.uploadObject(bucket, name, contentType,  buffer);
                log(command.short ? uploaded.objectId : uploaded);
            }
        } catch(err) {
            error(err);
        }
    });

program
    .command('download-object [bucket] [object] [filename]')
    .alias('do')
    .description('Download file from bucket.')
    .action(async function(bucket, object, filename, command) {
        try {
            if (!bucket) {
                bucket = await promptBucket();
            }
            if (!object) {
                object = await promptObject(bucket);
            }
            if (!filename) {
                filename = object;
            }
    
            const arrayBuffer = await data.downloadObject(bucket, object);
            // TODO: add support for streaming data directly to disk instead of getting entire file into memory first
            fs.writeFileSync(filename, Buffer.from(arrayBuffer), { encoding: 'binary' });
        } catch(err) {
            error(err);
        }
    });

program
    .command('object-urn [bucket] [object]')
    .alias('ou')
    .description('Get an URN (used in Model Derivative service) of specific bucket/object.')
    .action(async function(bucket, object, command) {
        try {
            if (!bucket) {
                bucket = await promptBucket();
            }
            if (!object) {
                object = await promptObject(bucket);
            }
    
            const details = await data.getObjectDetails(bucket, object);
            log(Buffer.from(details.objectId).toString('base64').replace(/=/g, ''));
        } catch(err) {
            error(err);
        }
    });

program
    .command('create-signed-url [bucket] [object]')
    .alias('csu')
    .description('Creates signed URL for specific bucket and object key.')
    .option('-s, --short', 'Output signed URL instead of the entire JSON.')
    .option('-a, --access <access>', 'Allowed access types for the created URL ("read", "write", or the default "readwrite").', 'readwrite')
    .action(async function(bucket, object, command) {
        try {
            if (!bucket) {
                bucket = await promptBucket();
            }
            if (!object) {
                object = await promptObject(bucket);
            }
    
            const info = await data.createSignedUrl(bucket, object, command.access);
            log(command.short ? info.signedUrl : info);
        } catch(err) {
            error(err);
        }
    });

program.parse(process.argv);
if (!program.args.length) {
    program.help();
}
