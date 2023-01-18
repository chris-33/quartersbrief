import fs from 'fs/promises';
import path from 'path';

async function loadData(datadir) {
	// Make sure that GameParams.json is available and load it if it is
	let data = JSON.parse(await fs.readFile(path.join(datadir,'GameParams.json')));

	// Make sure that global-en.json is available and load it if it is
	// But if it doesn't exist it's not fatal
	let labels;
	try {
		labels = JSON.parse(await fs.readFile(path.join(datadir,'global-en.json')));		
	} catch(err) {
		labels = err;
	}

	return { data, labels };
}

export default loadData;