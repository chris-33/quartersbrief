import config from '../init/config.js';
import path from 'path';
import { readdir } from 'fs/promises';

/**
 * Scans the World of Warships folder (specifically, the bin/ subfolder) for all present versions and the returns the highest one.
 * Versions can be identified because they are numerically named folders; the latest is the one with the highest number.
 * @return {number} The highest build number found.
 * @throws If the folder does not exist, or cannot be accessed.
 */
export async function latestBuild() {
	// Find the highest-numbered subdirectory of wows/bin
	let builds = (await readdir(path.join(config.wowsdir, 'bin'), { encoding: 'utf8', withFileTypes: true }))
		.filter(dirent => dirent.isDirectory())
		.map(dirent => dirent.name)
		.filter(name => name.match(/\d+/));
	let result = Math.max(...builds);
	return result;
}