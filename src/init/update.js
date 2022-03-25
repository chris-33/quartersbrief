import xml from 'xml2js';
import config, { paths } from './config.js';
import path from 'path';
import fse from 'fs-extra';
import gettext from 'gettext-parser';
import os from 'os';
import rootlog from 'loglevel';
import { fileURLToPath } from 'url';
import { exec as _exec } from 'child_process';
import { promisify } from 'util';
const exec = promisify(_exec);

const basepath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const dedicatedlog = rootlog.getLogger('Updater');

let _preferences;
async function readPreferences() {
	if (_preferences !== undefined) return _preferences;

	try {
		let data = await fse.readFile(path.join(config.wowsdir, 'preferences.xml'), 'utf8');
		data = await xml.parseStringPromise(
			data,
			{ 
				trim: true, // Remove leading and trailing whitespaces from text nodes
				explicitArray: false // Only create arrays for nodes appearing more than once

			});
		_preferences = data['preferences.xml'];
	} catch (err) {
		if (err.code === 'ENOENT') {
			dedicatedlog.error(`Could not find expected file preferences.xml at ${config.wowsdir}`);
			_preferences = null;
		} else throw err;
	}
	return _preferences;
}

async function shouldUpdate() {
	function needsUpdate(current, remembered) {
		remembered = remembered.split(',').map(x => Number(x));
		current = current.split(',').map(x => Number(x));

		for (let i = 0; i < current.length; i++)
			if (remembered[i] < current[i])
				return true;
		return false;		
	}

	if (config.updatePolicy === 'prohibit') return false;
	if (config.updatePolicy === 'force') return true;	

	// Read and parse wowsdir/preferences.xml
	let current = await getGameVersion();
	if (!current) {
		rootlog.warn(`Could not read current game version. Skipping update check.`);
		return false;
	}
	dedicatedlog.debug(`Current game version detected as ${current}`);

	// Read the last remembered version from the .version file in the quartersbrief config directory. 
	// This is the version of the game that the last used data was extracted from.
	// If that file does not exist, make the last remembered version "0,0,0,0" which will force an update.
	let remembered;
	try {
		remembered = await fse.readFile(path.join(paths.config, '.version'), 'utf8');
		dedicatedlog.debug(`Last known data version detected as ${remembered}`);
	} catch (err) {
		if (err.code === 'ENOENT') {
			remembered = '0,0,0,0';
			dedicatedlog.debug(`Last data version unknown, assuming ${remembered}`);
		} else throw err;
	}
	return needsUpdate(current, remembered);
}

// function checkTools() {
// 	let result;
// 	if (!shell.test('-e', path.join(basepath, 'tools/wowsunpack/wowsunpack.exe')))
// 		result = (result ?? []).push('wowsunpack.exe');

// 	if (!shell.test('-e', path.join(basepath, 'tools/gameparams2json/OneFileToRuleThemAll.py')))
// 		result = (result ?? []).push('EdibleBug/WoWS-GameParams');

// 	return result;
// }


async function getGameVersion() {
	return (await readPreferences())?.clientVersion;
}

async function getBuildNo() {	
	let result = await readPreferences();
	if (result) {
		result = result.scriptsPreferences.net_credentials.last_server_version;
		result = result
			.substring(result.lastIndexOf(',') + 1);
		dedicatedlog.debug(`Build number read as ${result}`);
		if (result && await fse.pathExists(path.join(config.wowsdir, 'bin', result))) {
			dedicatedlog.debug(`Folder ${path.join(config.wowsdir, 'bin', result)} found, resuming with build number ${result}.`)
			return result;
		}
	}

	dedicatedlog(`No valid build number read, attempting to deduce`);

	// Reading the buildno either failed outright or the number we got did not exist in wows/bin
	// So instead return highest-numbered subdirectory of wows/bin
	let builds = await fse.readdir(path.join(config.wowsdir, 'bin/*/'));
	dedicatedlog(`Available build numbers ${builds}`);
	result = Math.max(...builds.filter(name => name.matches(/\d+/)));
	dedicatedlog(`Build number deduced to be ${result}`);
	return result;
}

async function moToJSON(src, dest) {
	let data  = await fse.readFile(src);
	data = gettext.mo.parse(data);
	data = data.translations; // Drop headers and charset
	data = data['']; // Translations are all under this key for some reason. Maybe the gettext default context?
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

function wowsunpack(res, dest, buildno) {
	// Construct the path of the current version's idx subdirectory. This sits in a subdirectory of bin that is a
	// number, and appears to be the last component of the server version (presumably this is the build number). 
	// Fortunately, preferences.xml also contains the last known server version. Extract the build number from it,
	// then construct the path to wowsdir/bin/<buildno>/idx
	const idxPath = path.join(
		config.wowsdir, 
		'bin',
		buildno, 
		'idx');

	let cmd = '';
	if (os.type() === 'Linux') cmd += 'wine ';

	cmd += `${path.resolve(path.join(basepath, 'tools/wowsunpack/wowsunpack.exe'))} `;

	cmd += `${idxPath} `
		+ `--packages ${path.join(config.wowsdir, 'res_packages')} `
		+ `--output ${dest} `
		+ `--extract `
		+ `--include  ${res}`

	dedicatedlog.debug(`Runnning ${cmd}`);
	return exec(cmd)
}


async function update() {
	const version = await getGameVersion();

	if (!await shouldUpdate()) return;
	else rootlog.info(`Data update needed to version ${version}`);

	// if !(checkTools()) {
	// 	rootlog.error(``);
	// }

	const buildno = await getBuildNo();


	await Promise.all([
		fse.rename(
			path.join(paths.data, 'global-en.json'), 
			path.join(paths.data, 'global-en.json.bak')),
		fse.rename(
			path.join(paths.data, 'GameParams.json'), 
			path.join(paths.data, 'GameParams.json.bak'))
	]);
	
	// Turn global.mo file for the current version into global-en.json
	try {
		await moToJSON(
			path.join(config.wowsdir, 'bin', buildno, 'res/texts/en/LC_MESSAGES/global.mo'), 
			path.join(paths.data, 'global-en.json'));
	} catch (err) {
		rootlog.error(`There was an error while updating the labels: ${err.code} ${err.message}`);
	} finally {
		// If the operation was unsuccessful, use what we had before.
		if (!fse.existsSync(path.join(paths.data, 'global-en.json'))) {
			rootlog.warn(`Update of labels unsuccesful, reverting to previous version`);
			fse.rename(
				path.join(paths.data, 'global-en.json.bak'), 
				path.join(paths.data, 'global-en.json'));
		}
	}

	try {
		// Extract GameParams.data to OS's temp dir
		await wowsunpack('content/GameParams.data', path.join(paths.temp), buildno);
		// await fse.move(
		// 	path.join(basepath, 'tools/gameparams2json/content/GameParams.data'),
		// 	path.join(basepath, 'tools/gameparams2json/GameParams.data'));
		// Run the converter from the World of Warships Fitting Tool
		// It will convert the GameParams.data into GameParams.json
		await exec(`python3 ${path.join(basepath, 'tools/gameparams2json/OneFileToRuleThemAll.py')}`, { cwd: path.join(paths.temp, 'content') });
		// Move the converted file and drop the '-0' that the converter always tags on
		await fse.move(
			path.join(paths.temp, 'content/GameParams-0.json'), 
			path.join(paths.data, 'GameParams.json'));
		// Clean up after ourselves
		await fse.remove(path.join(paths.temp, 'tools/gameparams2json/content'));
	} catch (err) {
		rootlog.error(`There was an error while updating the game data: ${err.code} ${err.message}`);
	} finally {
		// If the operation was unsuccessful, use what we had before.
		if (!fse.existsSync(path.join(paths.data, 'GameParams.json'))) {
			rootlog.warn(`Update of game data was unsuccesful, reverting to previous version`);
			fse.rename(path.join(paths.data, 'GameParams.json.bak'), path.join(paths.data, 'GameParams.json'));
		}
	}

	fse.writeFile(path.join(paths.config, '.version'), version);
}

export default update;
