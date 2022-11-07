import rootlog from 'loglevel';
import fs from 'fs/promises';
import path from 'path';

/**
 * This class encapsulates update transactions. Functions for the actual update logic can be registered and will be called sequentially. 
 * Updates are atomic - if one of the update functions fails, the entire update has failed. In this case, `Updater` will attempt to rollback
 * the update to the state it was in before. 
 */
export default class Updater {
	updates = [];

	static ROLLBACK_SUFFIX = '.rollback';

	/**
	 * Creates a new `Updater` object.
	 * @param {String} source The World of Warships base directory
	 * @param {String} dest   The target directory to store update data in
	 * @param {Function[]} [updates] The update functions to run. If this is ommitted, updates can also be registered later with Updater#register
	 */
	constructor(source, dest, updates) {
		this.source = source;
		this.dest = dest;

		updates?.forEach(update => this.register(update));
	}

	/**
	 * Registers an additional update function to run. Update functions may be asynchronous.
	 *
	 * The function will be called by Updater#update with the following parameters:
	 * - The World of Warships directory,
	 * - The target data directory,
	 * - The build number being updated to,
	 * - The update options, augmented with the previous data's build number (if any) in `prev` and the path to that data (if any) in `prevPath`
	 * @param  {Function} update The update function to register
	 */
	register(update) {
		this.updates.push(update)
	}

	/**
	 * Scans the World of Warships folder (specifically, the bin/ subfolder) for all present versions and the returns the highest one.
	 * Versions can be identified because they are numerically named folders; the latest is the one with the highest number.
	 * @return {number} The highest build number found.
	 * @throws If the folder does not exist, or cannot be accessed.
	 */
	async detectGameVersion() {
		const dedicatedlog = rootlog.getLogger(this.constructor.name);
	
		// Find the highest-numbered subdirectory of wows/bin
		let builds = (await fs.readdir(path.join(this.source, 'bin'), { encoding: 'utf8', withFileTypes: true }))
			.filter(dirent => dirent.isDirectory())
			.map(dirent => dirent.name)
			.filter(name => name.match(/\d+/));
		dedicatedlog.debug(`Detected build numbers: ${builds.join(', ')}`);

		let result = Math.max(...builds);
		dedicatedlog.debug(`Highest build number is ${result}`);

		return result;
	}

	/**
	 * Gets the build number of the current data from the `.version` file in the data directory.
	 * @return {number} The contents of the `.version` file as a number, or `undefined` if the file does not exist.
	 * @throws If the file cannot be accessed, or if the contents are not a number.
	 */
	async recallVersion() {
		const dedicatedlog = rootlog.getLogger(this.constructor.name);

		// Read the last remembered version from the .version file in the quartersbrief data directory. 
		// This is the version of the game that the last used data was extracted from.
		// If that file does not exist, make the last remembered version "0,0,0,0" which will force an update.
		try {
			let contents = await fs.readFile(path.join(this.dest, '.version'), 'utf8')
			let result = Number(contents);
			if (Number.isNaN(result)) 
				throw new TypeError(`Expected remembered version to be a number but it was ${contents}`);

			dedicatedlog.debug(`Remembered version is ${result}`);
			return result;
		} catch (err) {
			if (err.code === 'ENOENT') {
				dedicatedlog.debug(`Could not detect remembered version`);
				return undefined;
			} else throw err;
		}
	}

	/**
	 * Checks whether an update is needed, based on the detected game version, the remembered version, and the update policy specified in `options`.
	 *
	 * The following rules apply:
	 * - An update is always needed if `options.updatePolicy === 'force'`, regardless of detected and remembered version numbers
	 * - An update is never needed if `options.updatePolicy === 'prohibit'`, regardless of detected and remembered version numbers
	 * - An update is needed if `remembered` is undefined or null
	 * - Otherwise, an update is needed if `remembered < detected`
	 * 
	 * @param  {Number} detected   The current game version
	 * @param  {Number} remembered The current data version
	 * @param  {String} [options.updatePolicy]  The update policy to use. 
	 * @return {Boolean}            `true` if an update is needed based on the above rules, `false` otherwise.
	 */
	needsUpdate(detected, remembered, options) {
		const dedicatedlog = rootlog.getLogger(this.constructor.name);

		let result;
		if (options?.updatePolicy === 'prohibit') {
			dedicatedlog.debug(`Update policy is "prohibit"`);
			result = false;
		}
		if (options?.updatePolicy === 'force') {
			dedicatedlog.debug(`Update policy is "force"`);
			result = true;
		}

		if (result === undefined) {
			result ??= (remembered ?? 0) < detected;
		}
		dedicatedlog.debug(`${result ? 'An' : 'No'} update is needed`);
		return result;
	}

	/**
	 * Commits the update by setting `buildno` as the new remembered version and removing the snapshot that was
	 * created at the beginning of the update.
	 * @param  {Number} buildno  The build number being updated to. This becomes the new remembered version.
	 * @param  {String} [rollback] The path of the snapshot directory. If ommitted, snapshot removal is skipped.
	 */
	async commit(buildno, rollback) {
		const dedicatedlog = rootlog.getLogger(this.constructor.name);

		await fs.writeFile(path.join(this.dest, '.version'), String(buildno));
		dedicatedlog.debug(`Remembering version ${buildno}`);

		if (rollback) {
			await fs.rm(rollback, { recursive: true, force: true });
			dedicatedlog.debug(`Removed rollback data`);
		} else
			dedicatedlog.debug(`No rollback data to remove`);
	}

	/**
	 * Rolls back the update by removing the data directory and reinstating the snapshot. 
	 * @param  {String} [rollback] The path of the snapshot directory. If this is falsy, no snapshot data
	 * is reinstated, but the current data directory is still removed.
	 * @return {boolean}          `true` if snapshot was reinstated, `false` if not.
	 */
	async rollback(rollback) {
		const dedicatedlog = rootlog.getLogger(this.constructor.name);

		await fs.rm(this.dest, { recursive: true, force: true });
		dedicatedlog.debug(`Removed update data`);
		if (rollback) {
			await fs.rename(rollback, this.dest);
			dedicatedlog.debug(`Reinstated kept rollback data`);
			return true;
		} else {
			dedicatedlog.debug(`Could not roll back because there was no rollback data`);
			return false;
		}
	}

	/**
	 * Checks whether an update is needed, and if so, runs all registered update functions. 
	 * 
	 * Update functions are executed in the order they were registered. They are run sequentially, that is, an update function must have
	 * completed before the next is called. Each update function is called with the path to the World of Warships directory, the path to
	 * the data directory, the build number being updated to, and a copy of the `options` object augmented with the previous data version `prev` and
	 * the path to that previous version's data `prevPath`. 
	 * 
	 * If any update function throws (or rejects), the entire update is considered to have failed. In this case, this method will attempt
	 * to roll back the (partially completed) update by discarding the data accumulated by the partial update and reinstating the previous data. 
	 *
	 * Specifically, it performs the following steps:
	 * 1. Detects the current game version (Updater#detectGameVersion)
	 * 2. Recalls the current data version (Updater#recallVersion)
	 * 3. Checks whether an update is needed based on those version numbers and `options.updatePolicy`
	 * 4. If an update is needed, takes a snapshot of the current data (Updater#snapshot)
	 * 5. Runs all registered update functions.
	 * 6. If step 5 completed normally, remembers the detected game version as the new current data version. (Updater#commit)
	 * 7. If step 5 terminated abnormally (threw/rejected), discards any data created by it and rolls back to the previous data. (Updater#rollback)
	 * 
	 * @param  {String} [options.updatePolicy] The update policy to use when determining whether an update is needed. Can be `'force'`, `'prohibit'`,
	 * `'auto'`, or ommitted altogether.
	 * @returns {Number} -`1` if no update was necessary, `0` if the update failed, `1` if the update completed normally. This means that for a
	 * failed update, the result is falsy, and for a skipped or successful update the result is truthy.
	 */
	async update(options) {
		const dedicatedlog = rootlog.getLogger(this.constructor.name);

		let detected = await this.detectGameVersion();
		let remembered = await this.recallVersion();

		if (this.needsUpdate(detected, remembered, options)) {
			let rollback = await this.snapshot();
			await fs.mkdir(this.dest, { recursive: true });
			let success;
			try {
				// Run updates sequentially, waiting for each
				for (let i = 0; i < this.updates.length; i++) {
					let update = this.updates[i];
					const optns = { prev: remembered, prevPath: rollback, ...options };
					dedicatedlog.debug(`Calling update function ${update.name || '#' + i}(${[this.source, this.dest, detected, optns ].join(',')})`);
					await update(this.source, this.dest, detected, optns);
				}
				success = true;
			} catch (err) {
				success = false;
			}
			if (success)
				await this.commit(detected, rollback);
			else
				await this.rollback(rollback);
			return Number(success);
		} else
			return -1;
	}
	
	/**
	 * Takes a snapshot of the current data. The current data directory is renamed, attaching the suffix `'rollback'`.
	 * 
	 * @return {String} The full path to the snapshot directory, or `undefined` if there was no current data directory.
	 */
	async snapshot() {
		const dedicatedlog = rootlog.getLogger(this.constructor.name);
		let rollback = `${this.dest}${Updater.ROLLBACK_SUFFIX}`;
		try {
			await fs.rename(this.dest, rollback);
			dedicatedlog.debug(`Kept existing data for potential rollback: ${rollback}`);
		} catch (err) {
			if (err.code === 'ENOENT'){
				rollback = undefined;
				dedicatedlog.debug(`There was no data from a previous version to keep for rollback`);
			}
			else throw err;
		}
		return rollback;
	}	
}