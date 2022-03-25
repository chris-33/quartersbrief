import fse from 'fs-extra';
import path from 'path';
import log from 'loglevel';

async function loadData(datadir) {
	// Make sure that GameParams.json is available and load it if it is
	let data;
	if (!await fse.pathExists(path.join(datadir, 'GameParams.json'))) {
		log.error(`Could not find game data at ${path.join(datadir, 'GameParams.json')}`);
		throw new Error(`Could not find game data at ${path.join(datadir, 'GameParams.json')}`);
	} else {
		let t0 = Date.now();
		data = JSON.parse(await fse.readFile(path.join(datadir,'GameParams.json')));
		log.info(`Loaded game data in ${Date.now() - t0}ms.`);
	}

	// Make sure that global-en.json is available and load it if it is
	// But if it doesn't exist it's not fatal
	let labels;
	if (!await fse.pathExists(path.join(datadir, 'global-en.json'))) {
		log.warn(`Could not find labels at ${path.join(datadir, 'global-en.json')}`);
	} else {
		let t0 = Date.now();
		labels = JSON.parse(await fse.readFile(path.join(datadir,'global-en.json')));
		log.info(`Loaded labels in ${Date.now() - t0}ms.`);	
	}

	return { data, labels };
}

export default loadData;