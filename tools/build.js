const path = require('path');
const fs = require('fs');
const { exec } = require('pkg');
const JSZip = require('jszip');

const SCRIPTS = Object.values(require('../package.json').bin);
const LABEL = `forge-cli-utils.${process.platform}-${process.arch}`;

async function build() {
    const binDir = path.resolve(__dirname, '..', 'bin');
    const tmpDir = path.resolve(binDir, LABEL);

    // Package individual scripts listed in package.json
    for (const filename of SCRIPTS) {
        const srcPath = path.resolve(__dirname, '..', filename);
        console.log('Packaging script', srcPath);
        await exec([srcPath, '--target', 'host', '--out-dir', tmpDir]);
    }

    // Compress scripts into a single zip file
    const archive = new JSZip();
    for (const filename of fs.readdirSync(tmpDir)) {
        const buff = fs.readFileSync(path.resolve(tmpDir, filename));
        archive.file(filename, buff);
    }
    const zipped = await archive.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(path.resolve(binDir, LABEL + '.zip'), zipped);
}

build();
