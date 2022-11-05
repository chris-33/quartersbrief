import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs/promises';
import os from 'os';
import { execa } from 'execa';

/**
 * Returns a step function that extracts the specified resources of the specified build number to the specified destination using `wowsunpack.exe`. 
 * On Windows, `wowsunpack` is called directly, on Linux, it is called through `wine`. 
 *
 * The returned function takes the resource to extract as an argument. `resource` can either be a string for simple extractions,
 * or an object `{ includes, excludes }` each containing an array of inclusion/exclusion patterns. It returns an array of strings containing
 * the paths of the extracted files.
 * 
 * Because this will frequently form the start of a step chain, it supports a convenience form where the resource to extract can be 
 * passed directly. This form is equivalent to the step sequence `[ () => resource, extract(wows, dest, buildno) ]`, but more readable.
 *
 * @param  {String} wows	 The World of Warships base directory
 * @param  {String} dest     The directory to extract to
 * @param  {number} buildno  The build number to extract from
 * @param  {String} [resource]	The resource to extract. If this is not specified, the returned extractor function will take the resource to
 * extract as an argument.
 * @return {Function}          The extractor function.
 */
export function extract(wows, dest, buildno, resource) {
	async function extractor(resource) {
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
			wows, 
			'bin',
			String(buildno), 
			'idx');

		const wowsunpack = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../', 'res/wowsunpack.exe');
		let cmd;
		let args;
		if (os.type() === 'Linux') {
			cmd = 'wine';
			args = [ wowsunpack ];
		} else if (os.type() === 'Windows_NT') {
			cmd = wowsunpack;
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
			'--packages', path.join(wows, 'res_packages'),
			'--output', dest,
			'--extract',
			'--list',
		]);
		args = args.concat(resource.include.flatMap(incl => [ '--include', incl ]));
		if (resource.exclude)
			args = args.concat(resource.exclude.flatMap(excl => [ '--exclude', excl ]));

		return (await execa(cmd, args))
			.stdout
			.split('\r\n') // The stdout comes from wowsunpack.exe - a Windows program. So we need to use the Windows line separator here, regardless of host OS
			.map(line => path.join(dest, line));
	}

	if (resource) 
		return () => extractor(resource);
	else
		return extractor;
}

/**
 * Returns a step function that reads the specified file. The returned function takes the file name
 * as an argument and returns the file's content as a `Buffer` or a `String` depending on the specified encoding. 
 *
 * Because this will frequently form the start of a step chain, it supports a convenience form where the file name can be 
 * passed directly. In this case, `options` **must** be specified (but may be `null` or `undefined`). This form is equivalent to
 * the step sequence `[ () => file, readFile() ]`, but more readable.
 * @param  {String|Object} [options='utf8'] An options object, or the encoding, to be passed to [fs.readFile](https://nodejs.org/api/fs.html#fspromisesreadfilepath-options)
 * @param  {String} [file]	The file to read from. If this is ommitted, the step function reads the file that it gets passed as an argument.
 * @return {Function}         The reader function.
 */
export function readFile(options='utf8', file) {
	function reader(file) {
		return fs.readFile(file, options);
	}

	if (arguments.length > 1)
		return () => reader(file)
	else return reader;
}

/**
 * Returns a step function that writes its argument to the specified file as JSON. If the path to the file
 * does not exist, it is created. The step function returns the path of the written file.
 * @param  {String} file The file to write to
 * @return {Function} The writer function
 */
export function writeJSON(file) {
	return async function(data) {
		await fs.mkdir(path.dirname(file), { recursive: true });
		return fs.writeFile(file, JSON.stringify(data)).then(() => file);
	}
}