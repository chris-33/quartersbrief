import { Battle } from '../model/battle.js';
import { readFile } from 'fs/promises';
import path from 'path';
import rootlog from 'loglevel';

/**
 * Class to read 'tempArenaInfo.json' from the World of Warship replays directory and parse it to an object.
 * It can recover from `ENOENT` errors (meaning the file or the directory isn't there) and `EACCES` errors (meaning
 * the file or the replays directory have insufficient permissions).
 */
export default class BattleDataReader {
	constructor(replaydir) {
		if (!replaydir) 
			throw new TypeError(`Cannot construct a ${this.constructor.name} without a replaydir`);
		this.replaydir = replaydir;
	}

	/**
	 * Attempt to read `tempArenaInfo.json` and return its contents.
	 * @return {Object} The contents of `tempArenaInfo.json`, or `null` if the file doesn't exist, the watched directory
	 * doesn't exist, or either one has insufficient permissions for reading.
	 */
	async read() {
		try {
			return new Battle(JSON.parse(await readFile(path.join(this.replaydir, 'tempArenaInfo.json'))));
		} catch (err) {
			switch (err.code) {
				case 'ENOENT':
					// This means either there is currently no battle, or the provided path was wrong
					// The most likely cause is there is no battle, so this is not entirely unexpected behavior.
					// We will return null and let the main algorithm figure out where to go from here.
					// But in case the path was wrong, also put a line in the rootlog
					rootlog.debug(`No battle found when reading ${this.replaydir}`);
					return null;
				case 'EACCES': 
					// Permission denied. This is not recoverable for quartersbrief, put an error in the rootlog
					rootlog.error(`Permission denied when trying to read from ${this.replaydir}`);
					return null;
				default:
					throw err;
			}
		}		
		
	}
}
