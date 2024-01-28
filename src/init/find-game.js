import { Glob } from 'glob';
import path from 'path';

export default async function findGame(paths) {	
	if (typeof paths === 'string')
		paths = [ paths ];

	if (!Array.isArray(paths))
		throw new TypeError(`Expected to be given a path or list of paths to search, but got ${typeof paths}`);

	const aborter = new AbortController();
	const glob = new Glob(
		// As per docs, must ONLY use forward slashes even on Windows.
		// See https://www.npmjs.com/package/glob#windows
		paths
			.map(p => path.posix.format(path.parse(p)))
			.map(p => p.endsWith('WorldOfWarships.exe') ? p : path.posix.join(p, 'WorldOfWarships.exe')), 
		{ signal: aborter.signal });

	try { 
		for await (const result of glob) {
			aborter.abort();
			return path.dirname(result);
		}
	} catch (err) { 
		if (err.name !== 'AbortError') throw err; 
	}	
}