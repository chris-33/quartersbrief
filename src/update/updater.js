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
	 * Scans the provided folder for numerically named subdirectories and returns the highest one.
	 * @return {number} The highest numerically-named subdirectory found.
	 * @throws If the folder does not exist, or cannot be accessed.
	 */
	async detectVersion(dir) {
		const dedicatedlog = rootlog.getLogger(this.constructor.name);
	
		// Find the highest-numbered subdirectory of wows/bin
		let builds = (await fs.readdir(dir, { encoding: 'utf8', withFileTypes: true }))
			.filter(dirent => dirent.isDirectory())
			.map(dirent => dirent.name)
			.filter(name => name.match(/\d+/));
		dedicatedlog.debug(`Detected build numbers in ${dir}: ${builds.join(', ')}`);

		let result = Math.max(...builds);
		if (result === -Infinity) result = undefined;
		dedicatedlog.debug(`Highest build number in ${dir} is ${result}`);

		return result;
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

		let result = true;
		if (options?.allowUpdates === false) { // Not the same as !options?.update, because !undefined === true
			dedicatedlog.debug(`Automatic updates are disabled.`);
			result = false;
		}

		result = result && (remembered ?? 0) < detected;
		dedicatedlog.debug(`${result ? 'An' : 'No'} update is needed`);
		return result;
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
	 * @returns {Number} - The highest available data version number
	 */
	async update(options) {
		const dedicatedlog = rootlog.getLogger(this.constructor.name);

		let detected = await this.detectVersion(path.join(this.source, 'bin'));
		let remembered = await this.detectVersion(this.dest);

		if (this.needsUpdate(detected, remembered, options)) {
			rootlog.info(`Updating data to version ${detected}`);
			await fs.mkdir(path.join(this.dest, String(detected)), { recursive: true });
			try {
				// Run updates sequentially, waiting for each
				for (let i = 0; i < this.updates.length; i++) {
					let update = this.updates[i];
					const optns = { prev: remembered, prevPath: path.join(this.dest, String(remembered)), ...options };
					const args = [
						this.source, 
						path.join(this.dest, String(detected)), 
						detected, 
						optns
					];
					dedicatedlog.debug(`Calling update function ${update.name || '#' + i}(${args.join(',')})`);
					await update.apply(null, args);
				}
				await this.commit(remembered);
				return detected;
			} catch (err) {
				rootlog.error(`Update failed: ${err.message}`)
				await this.rollback(detected);
				return remembered;
			}
		} else
			return remembered;
	}

	/**
	 * Commits the update by deleting the old version's data directory.
	 * @param  {number} oldVersion  The previous build number (before the update).
	 */
	async commit(oldVersion) {
		const dedicatedlog = rootlog.getLogger(this.constructor.name);
		oldVersion = String(oldVersion);

		if (oldVersion) {
			await fs.rm(path.join(this.dest, oldVersion), { recursive: true, force: true });
			dedicatedlog.debug(`Removed previous data`);
		} else {
			dedicatedlog.debug(`No previous data to remove`);
		}
	}

	/**
	 * Rolls back the update by removing the new version's data directory. 
	 * @param  {number} newVersion The version number that was being updated to.
	 */
	async rollback(newVersion) {
		const dedicatedlog = rootlog.getLogger(this.constructor.name);
		newVersion = String(newVersion);

		await fs.rm(path.join(this.dest, newVersion), { recursive: true, force: true });
		dedicatedlog.debug(`Removed update data`);
	}
}