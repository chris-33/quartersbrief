import xml from 'xml2js';
import config, { paths } from './config.js';
import path from 'path';
import fse from 'fs-extra';
import gettext from 'gettext-parser';
import os from 'os';
import rootlog from 'loglevel';
import { execa } from 'execa';

const dedicatedlog = rootlog.getLogger('Updater');

async function getBuildNo() {	
	// Find the highest-numbered subdirectory of wows/bin
	let builds = (await fse.readdir(path.join(config.wowsdir, 'bin'), { encoding: 'utf8', withFileTypes: true }))
		.filter(dirent => dirent.isDirectory())
		.map(dirent => dirent.name)
		.filter(name => name.match(/\d+/));
	dedicatedlog.debug(`Available game versions: ${builds}`);
	let result = Math.max(...builds);
	dedicatedlog.debug(`Resuming with game version ${result}`);
	return result;
}

async function needsUpdate() {
	if (config.updatePolicy === 'prohibit') return false;
	if (config.updatePolicy === 'force') return true;	

	// Read and parse wowsdir/preferences.xml
	let current = await getBuildNo();

	// Read the last remembered version from the .version file in the quartersbrief data directory. 
	// This is the version of the game that the last used data was extracted from.
	// If that file does not exist, make the last remembered version "0,0,0,0" which will force an update.
	let remembered;
	try {
		remembered = Number(await fse.readFile(path.join(paths.data, '.version'), 'utf8'));
		dedicatedlog.debug(`Last known data version detected as ${remembered}`);
	} catch (err) {
		if (err.code === 'ENOENT') {
			remembered = 0;
			dedicatedlog.debug(`Last data version unknown, assuming ${remembered}`);
		} else throw err;
	}
	return remembered < current;
}

async function updateLabels(buildno) {
	async function moToJSON(src, dest) {
		let data  = await fse.readFile(src);
		data = gettext.mo.parse(data);
		data = data.translations; // Drop headers and charset
		data = data['']; // Use the default context
		// Right now, every translation entry is of the form
		// IDS_FOO: {
		//   msgid: IDS_FOO,
		//   msgstr: [ 'BAR'] 
		// }
		// 
		// We need it as IDS_FOO: 'BAR'
		for (let key in data)
			data[key] = data[key].msgstr[0];
		data = JSON.stringify(data);
		return fse.writeFile(dest, data);
	}

	// Keep a backup in case the update goes wrong
	try {
		await fse.rename(
				path.join(paths.data, 'global-en.json'), 
				path.join(paths.data, 'global-en.json.bak'))
	} catch(err) {
		if (err.code === 'ENOENT') {
			dedicatedlog.warn(`Could not find existing file global-en.json to keep as a backup.`);
		} else throw err;		
	}

	// Turn global.mo file for the current version into global-en.json
	try {
		await moToJSON(
			path.join(config.wowsdir, 'bin', String(buildno), 'res/texts/en/LC_MESSAGES/global.mo'), 
			path.join(paths.data, 'global-en.json'));
		return true;
	} catch (err) {
		rootlog.error(`There was an error while updating the labels: ${err.code ? err.code + ' ' : ''}${err.message}`);
	} finally {
		// If the operation was unsuccessful, use what we had before.
		if (!await fse.pathExists(path.join(paths.data, 'global-en.json'))) {
			rootlog.warn(`Update of labels unsuccesful, reverting to previous version`);
			fse.rename(
				path.join(paths.data, 'global-en.json.bak'), 
				path.join(paths.data, 'global-en.json'));
		}
	}
	return false;
}

async function updateGameParams(buildno) {
	function wowsunpack(res, dest, buildno) {
		// Construct the path of the current version's idx subdirectory. This sits in a subdirectory of bin that is a
		// number, and appears to be the last component of the server version (presumably this is the build number). 
		// Fortunately, preferences.xml also contains the last known server version. Extract the build number from it,
		// then construct the path to wowsdir/bin/<buildno>/idx
		const idxPath = path.join(
			config.wowsdir, 
			'bin',
			String(buildno), 
			'idx');

		let cmd = '';
		if (os.type() === 'Linux') cmd += 'wine ';

		cmd += `${path.resolve(path.join(paths.base, 'tools/wowsunpack/wowsunpack.exe'))}`;

		let args = [
			idxPath,
			`--packages ${path.join(config.wowsdir, 'res_packages')}`,
			`--output ${dest}`,
			`--extract`,
			`--include ${res}`
		];

		dedicatedlog.debug(`Runnning ${cmd} ${args.join(' ')}`);
		return execa(cmd, args);
	}

	// Keep a backup in case the update goes wrong
	try {
		await fse.rename(
				path.join(paths.data, 'GameParams.json'), 
				path.join(paths.data, 'GameParams.json.bak'))
	} catch(err) {
		if (err.code === 'ENOENT') {
			dedicatedlog.warn(`Could not find existing file GameParams.json to keep as a backup.`);
		} else throw err;		
	}

	try {
		// Extract GameParams.data to OS's temp dir
		await wowsunpack('content/GameParams.data', paths.temp, buildno);
		// await fse.move(
		// 	path.join(basepath, 'tools/gameparams2json/content/GameParams.data'),
		// 	path.join(basepath, 'tools/gameparams2json/GameParams.data'));
		// Run the converter from the World of Warships Fitting Tool
		// It will convert the GameParams.data into GameParams.json
		await execa(`python3 ${path.join(paths.base, 'tools/gameparams2json/OneFileToRuleThemAll.py')}`, { cwd: path.join(paths.temp, 'content') });
		// Move the converted file and drop the '-0' that the converter always tags on
		await fse.move(
			path.join(paths.temp, 'content/GameParams-0.json'), 
			path.join(paths.data, 'GameParams.json'));
		// Clean up after ourselves
		await fse.remove(path.join(paths.temp, 'content'));
		return true;
	} catch (err) {
		rootlog.error(`There was an error while updating the game data: ${err.code} ${err.message}`);
		dedicatedlog.trace(err.stack);
	} finally {
		// If the operation was unsuccessful, use what we had before.
		if (!fse.existsSync(path.join(paths.data, 'GameParams.json'))) {
			rootlog.warn(`Update of game data was unsuccesful, reverting to previous version`);
			fse.rename(path.join(paths.data, 'GameParams.json.bak'), path.join(paths.data, 'GameParams.json'));
		}
	}
	return false;
}

async function update() {
	await fse.ensureDir(paths.data);

	const buildno = await getBuildNo();

	let success = (await Promise.all([ updateLabels(buildno), updateGameParams(buildno) ]))
						.reduce((prev, curr) => prev && curr, true);
	if(success) 
		await fse.writeFile(path.join(paths.data, '.version'), String(buildno));
}

export { needsUpdate, updateLabels, updateGameParams, update };
