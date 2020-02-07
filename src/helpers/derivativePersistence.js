const zlib = require('zlib') 
const jsZip = require('jszip');
const fs = require('fs-extra');
const path = require('path');
const { log, warn, error } = require('../common');
const ora = require('ora');

function getSanitizedStringArray (array) {
    return array && (array instanceof Array ? array : array.split(',')).map(e => e.trim())
}

module.exports = class DerivativePersistence {

	constructor (modelDerivative, urn) {
		this.modelDerivative = modelDerivative;
		this.urn = urn;
		this.persistPromises = {}
    	this.excludedRoles = ['Autodesk.CloudPlatform.PropertyDatabase'];
    	this.saved = 0;
    	this.toSave = 0;
        this.spinner = ora(`Processing: ${this.saved} of ${this.toSave} derivatives saved ...`).start()
	}

    setExcludeRoles (excludedRoles) {
        this.excludedRoles = getSanitizedStringArray(excludedRoles)
    }

    setOutputDirectory (directory) {
        this.directory = directory
    }

    addURNToPersist (derivativeUrn) {
        this.persistPromises[derivativeUrn] || (this.persistPromises[derivativeUrn] = this.persistDerivative(derivativeUrn))
    }

    getDerivativeURN (derivativeUrn, fileName) {
        return derivativeUrn.split('/')[0] + '/' + path.join(derivativeUrn.split('/').slice(1,-1).join('/'), fileName).replace(/\\/g, '/')
    }

    persistAssetsFromManifest (manifest, derivativeUrn) {
        return manifest.assets.forEach(e => {
            if(![...e.URI].some(c => [':', '?', '*', '<', '>', '|'].includes(c))) this.addURNToPersist(this.getDerivativeURN(derivativeUrn, e.URI))
        })
    }

    persistAssetsFromSVFPath (svfPath, derivativeUrn) {
        return new Promise((resolve, reject) => {
            try {
                fs.readFile(svfPath, (err, data) => {
                    if (err) reject(err);
                    jsZip.loadAsync(data).then(contents => {
                        contents.files['manifest.json'].async('string').then(data => {
                            this.persistAssetsFromManifest(JSON.parse(data), derivativeUrn);
                            resolve()
                        })
                    })
                })
            } catch (err) {
                reject(err)
            }
        })
    }

    persistAssetsFromManifestStream (stream, derivativeUrn) {
        return new Promise((resolve, reject) => {
            try {
                let data = '';
                const gstream = stream.pipe(zlib.createGunzip());
                gstream.on('data', chunk => data += chunk);
                gstream.on('finish', () => {
                    this.persistAssetsFromManifest(JSON.parse(data), derivativeUrn);
                    resolve()
                })
            } catch (err) {
                reject(err)
            }
        })
    }

    persistDerivative (derivativeUrn) { 
        return new Promise(async (resolve, reject) => {
            try {
                log('Fetching: ' + derivativeUrn);
                this.toSave++;
                this.spinner.text = `Processing: ${this.saved} of ${this.toSave} derivatives saved ...`;
                const filePath = path.join(this.directory || '', derivativeUrn.split('/').splice(1).join('/'));
                await fs.ensureFile(filePath);                
                const derivativeReadStream = await this.modelDerivative.getDerivativeStream(this.urn, derivativeUrn);
                const fileWriteStream = fs.createWriteStream(filePath);
                derivativeReadStream.on('error', err => reject(err));
                derivativeReadStream.on('finish', () => log('Finish reading: ' + derivativeUrn));
                fileWriteStream.on('error', err => reject(err));
                fileWriteStream.on('finish', async () => {
                    log('Saved to: ' + filePath);
                    this.spinner.text = `Processing: ${this.saved} of ${this.toSave} derivatives saved ...`;
                    this.saved++;
                    switch (path.extname(filePath)) {
                        case '.svf': 
                            await this.persistAssetsFromSVFPath(filePath, derivativeUrn);
                            break;
                        case '.f2d':
                        case '.f3d':
                            await this.persistAssetsFromManifestStream(await this.modelDerivative.getDerivativeStream(this.urn, this.getDerivativeURN(derivativeUrn, 'manifest.json.gz')), derivativeUrn)
                    }
                    resolve()
                });
                derivativeReadStream.pipe(fileWriteStream);
            } catch(err) {
                error('Error fetching:' + derivativeUrn)
                reject(err)
            }
        }).finally(() => delete this.persistPromises[derivativeUrn]);
    }

    persistDerivatives (children, force) {
        children.forEach(e => {
            const shouldForce = this.targetAssets && this.targetAssets.includes(e.guid);
            if (!e.guid || force || (!this.targetAssets || this.targetAssets.includes(e.guid)) && !this.excludedRoles.includes(e.role)) {
                if (e.children instanceof Array) this.persistDerivatives(e.children, shouldForce);
                if (typeof e.urn == 'string') this.addURNToPersist(e.urn)
            }
        });        
    }

    async fetch (assets, targetAssets) {
        this.targetAssets = getSanitizedStringArray(targetAssets);
        this.persistDerivatives(assets);
        try {
            while (Object.keys(this.persistPromises).length) 
                await Promise.all(Object.values(this.persistPromises));
            this.spinner.succeed(`Done: ${this.saved} of ${this.toSave} derivatives saved ...`)
        } catch(err) {
            this.spinner.fail(err.toString())
        }
    }
}