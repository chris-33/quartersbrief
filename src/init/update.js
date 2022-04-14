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
	let result = Math.max(...builds);
	return result;
}

async function needsUpdate() {
	if (config.updatePolicy === 'prohibit') return false;
	if (config.updatePolicy === 'force') return true;	

	// Read the last remembered version from the .version file in the quartersbrief data directory. 
	// This is the version of the game that the last used data was extracted from.
	// If that file does not exist, make the last remembered version "0,0,0,0" which will force an update.
	let remembered;
	try {
		remembered = Number(await fse.readFile(`${paths.data}/.version`), 'utf8');
		dedicatedlog.debug(`Last known data version was ${remembered}`);
	} catch (err) {
		if (err.code === 'ENOENT') {
			remembered = 0;
			dedicatedlog.debug(`Last data version unknown, assuming ${remembered}`);
		} else throw err;
	}

	let current = await getBuildNo();
	dedicatedlog.debug(`Current version is ${current}`);

	let result = remembered < current;
	dedicatedlog.debug(`${result ? 'An' : 'No'} update is needed`);
	return result;
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

	// Step 1: Keep a backup in case the update goes wrong
	let existed = await fse.pathExists(`${paths.data}/global-en.json`);
	if (existed) {
		await fse.rename(`${paths.data}/global-en.json`, `${paths.data}/global-en.json.bak`);
	} else
		dedicatedlog.warn(`Could not find an existing file global-en.json to keep as a backup.`);

	// Step 2: Turn global.mo file for the current version into global-en.json
	try {
		await moToJSON(
			`${config.wowsdir}/bin/${buildno}/res/texts/en/LC_MESSAGES/global.mo`,
			`${paths.data}/global-en.json`);
	} catch (err) {
		rootlog.error(`There was an error while updating the labels: ${err.code ? err.code + ' ' : ''}${err.message}`);
		dedicatedlog.debug(err.stack);
	}

	// Step 3: Check that the file exists now. If it does, this was a successful update, otherwise revert to previous.
	if (await fse.pathExists(`${paths.data}/global-en.json`)) {
		return true;
	} else if (existed) {
		// If the operation was unsuccessful, use what we had before.
		rootlog.warn(`Update of labels unsuccesful, reverting to previous version`);
		try {
			fse.rename(`${paths.data}/global-en.json.bak`, `${paths.data}/global-en.json`);
		} catch (err) {
			rootlog.error(`Reverting to previous version failed: ${err.code ? err.code + ' ' : ''}${err.message}`);
			dedicatedlog.debug(err.stack);
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
		// 
		// Need to actually use path.join here to make sure we're passing valid input into the command line call.
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

		dedicatedlog.debug(`Running ${cmd} ${args.join(' ')}`);
		return execa(cmd, args, { shell: true });
	}

	// Step 1: Keep a backup in case the update goes wrong
	let existed = await fse.pathExists(`${paths.data}/GameParams.json`);
	if (existed) {
		await fse.rename(`${paths.data}/GameParams.json`, `${paths.data}/GameParams.json.bak`);
	} else
		dedicatedlog.warn(`Could not find an existing file GameParams.json to keep as a backup`);

	// Step 2: Extract GameParams.data to OS's temp dir, then convert it to JSON and move the result to the data directory.
	try {
		// Extract GameParams.data to OS's temp dir
		await wowsunpack('content/GameParams.data', paths.temp, buildno);
		// Run the converter from the World of Warships Fitting Tool
		// It will convert the GameParams.data into GameParams.json
		await execa(`python3 ${path.join(paths.base, 'tools/gameparams2json/OneFileToRuleThemAll.py')}`, { cwd: path.join(paths.temp, 'content'), shell: true });
		// Move the converted file and drop the '-0' that the converter always tags on
		await fse.move(`${paths.temp}/content/GameParams-0.json`, `${paths.data}/GameParams.json`);
		// Clean up after ourselves
		await fse.remove(`${paths.temp}/content`);
	} catch (err) {
		rootlog.error(`There was an error while updating the game data: ${err.code ? err.code + ' ' : ''}${err.message}`);
		dedicatedlog.debug(err.stack);
	}

	// Step 3: Check that the file exists now. If it does, this was a successful update, otherwise revert to previous.

	// If the operation was unsuccessful, use what we had before.
	if (await fse.pathExists(`${paths.data}/GameParams.json`)) {
		return true;
	} else if (existed) {
		rootlog.warn(`Update of game data was unsuccesful, reverting to previous version`);
		try {
			fse.rename(path.join(paths.data, 'GameParams.json.bak'), path.join(paths.data, 'GameParams.json'));
		} catch (err) {
			rootlog.error(`Reverting to previous version failed: ${err.code ? err.code + ' ' : ''}${err.message}`);
			dedicatedlog.debug(err.stack);
		}
	}

	return false;
}

async function update() {
	await fse.ensureDir(paths.data);

	const buildno = await getBuildNo();
	rootlog.info(`Updating to build number ${buildno}. This might take a few minutes.`);

	let success = (await Promise.all([ updateLabels(buildno), updateGameParams(buildno) ]))
						.every(res => res);
	if (success)
		await fse.writeFile(path.join(paths.data, '.version'), String(buildno));
}

export { needsUpdate, updateLabels, updateGameParams, update };
