import config, { paths } from '../init/config.js';
import path from 'path';
import * as fs from 'fs/promises';
import os from 'os';
import { execa } from 'execa';
import rootlog from 'loglevel';

const dedicatedlog = rootlog.getLogger('Updater');

/**
 * Returns a step function that extracts the specified resources of the specified build number to the specified destination using `wowsunpack.exe`. 
 * On Windows, `wowsunpack` is called directly, on Linux, it is called through `wine`. 
 *
 * The returned function takes the resource to extract as an argument. `resource` can either be a string for simple extractions,
 * or an object `{ includes, excludes }` each containing an array of inclusion/exclusion patterns. It returns an array of strings containing
 * the paths of the extracted files.
 * 
 * @param  {String} dest     The directory to extract to
 * @param  {number} buildno  The build number to extract from
 * @return {Function}          The extractor function.
 */
export function extract(dest, buildno) {
	return async function(resource) {
		if (!buildno) 
			throw new TypeError(`No buildno specified`);
		if (!resource) 
			throw new TypeError(`No resource(s) to extract specified`);
		if (!dest) 
			throw new TypeError(`No destination to extract to specified`);

		// Construct the path of the current version's idx subdirectory. 
		// 
		// Need to actually use path.join here to make sure we're passing valid input into the command line call.
		const idxPath = path.join(
			config.wowsdir, 
			'bin',
			String(buildno), 
			'idx');

		let cmd;
		let args;
		if (os.type() === 'Linux') {
			cmd = 'wine';
			args = [ path.resolve(path.join(paths.base, 'tools/wowsunpack/wowsunpack.exe')) ];
		} else if (os.type() === 'Windows_NT') {
			cmd = path.resolve(path.join(paths.base, 'tools/wowsunpack/wowsunpack.exe'));
			args = [];
		} 

		// If resource to extract is a string, transfer it to a resource object that only has a single include pattern
		if (typeof resource === 'string') {
			resource = {
				include: [ resource ]
			};
		}

		// Construct arguments array
		args = args.concat([
			idxPath,
			'--packages', path.join(config.wowsdir, 'res_packages'),
			'--output', dest,
			'--extract',
			'--list',
		]);
		args = args.concat(resource.include.flatMap(incl => [ '--include', incl ]));
		if (resource.exclude)
			args = args.concat(resource.exclude.flatMap(excl => [ '--exclude', excl ]));

		dedicatedlog.debug(`Running ${cmd} ${args.join(' ')}`);
		return (await execa(cmd, args)).stdout;
	}
}

/**
 * Returns a step function that reads the specified file. The returned function takes the file name
 * as an argument and returns the file's content as a `Buffer` or a `String` depending on the specified encoding. 
 * @param  {String|Object} [options='utf8'] An options object, or the encoding, to be passed to [fs.readFile](https://nodejs.org/api/fs.html#fspromisesreadfilepath-options)
 * @return {Function}         The reader function.
 */
export function readFile(options='utf8') {
	return function(file) {
		return fs.readFile(file, options);
	}
}

/**
 * Returns a step function that writes its argument to the specified file as JSON. If the path to the file
 * does not exist, it is created.
 * @param  {String} file The file to write to
 * @return {Function} The writer function
 */
export function writeJSON(file) {
	return async function(data) {
		await fs.mkdir(path.dirname(file), { recursive: true });
		return fs.writeFile(file, JSON.stringify(data))
	}
}