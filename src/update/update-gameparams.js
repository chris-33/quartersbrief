import executeSteps, { each, passthrough } from './infra/execute-steps.js';
import { extract, readFile, writeJSON } from './infra/steps.js';
import pickle from 'jpickle';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import zlib from 'zlib';
import os from 'os';
import * as invariants from './invariants-gameparams.js';

const decompress = promisify(zlib.inflate);


// "Pickles" are a special way used by Python to serialize/unserialize objects to byte streams. No direct equivalent exists in Javascript/NodeJS,
// so we are using the jPickle library. This needs to be prepared before we can use it on GameParams.data, though. Specifically, we need to tell
// jpickle how to deal with types, classes and functions used within the pickle.
// This function registers target types for those used in the GameParams.data pickle.
function registerEmulations(pickle) {
	// Make classes for the below types.
	// Setting the name property is purely cosmetic, so we could also have just set all of them to Object
	['TypeInfo', 'GPData', 'GameParams', 'UIParams'].forEach(type => pickle.emulated[`GameParams.${type}`] = class {
		static {
			Object.defineProperty(this, 'name', { value: type });
		}
	});
	// Set emulations for some builtins. See https://docs.python.org/3/library/functions.html#built-in-functions

	// Return a new featureless object.
	// https://docs.python.org/3/library/functions.html#object
	pickle.emulated['__builtin__.object'] = Object;
	// Return True if all elements of the iterable are true (or if the iterable is empty).
	// https://docs.python.org/3/library/functions.html#all
	pickle.emulated['__builtin__.all'] = function(args) { 
		let iterable = Array.from(args[0]);
		return iterable.length === 0 || iterable.every(item => item); 
	};
	// Return True if any element of the iterable is true.
	// https://docs.python.org/3/library/functions.html#any
	pickle.emulated['__builtin__.any'] = function(args) { 
		let iterable = Array.from(args[0]);
		return iterable.length > 0 && iterable.some(item => item); 
		
	};
	// Return a new set object, optionally with elements taken from iterable.
	// https://docs.python.org/3/library/functions.html#func-set
	pickle.emulated['__builtin__.set'] = function(args) {
		let iterable = args[0];
		return new Set(iterable)
	};
	// The copyreg module offers a way to define functions used while pickling specific objects.
	// See https://docs.python.org/3/library/copyreg.html#module-copyreg
	// See https://github.com/python/cpython/blob/3.10/Lib/copyreg.py#L47
	pickle.emulated['copy_reg._reconstructor'] = function _reconstructor([cls, base, state]) {
		let result = new cls();
		Object.setPrototypeOf(result, base.prototype);
		Object.assign(result, state);
		return result;
	}

	return pickle;
}

export default async function updateGameParams(wows, dest, buildno) {
	registerEmulations(pickle);

	const resource = 'content/GameParams.data';
	const tmpdir = os.tmpdir();

	// This is basically a translation of the work by EdibleBug in https://github.com/EdibleBug/WoWS-GameParams/blob/master/OneFileToRuleThemAll.py
	// All props go to him.
	return executeSteps([
		extract(wows, tmpdir, buildno, resource),
		// The above returned an array of paths, even though we only extracted one file.
		// Make sure it really way exactly one, and return that one's path instead.
		extracted => {
			switch (extracted.length) {
				case 0: throw new Error(`Could not extract GameParams.data from game files`);
				case 1: return extracted[0];
				default: throw new Error(`Expected GameParams.data to be unique, but ${extracted.length} files were extracted`)
			}
		},
		// Read the extracted file as a Buffer
		readFile({ encoding: null }),
		// Delete the extracted file now that we have read it
		passthrough(async () => await fs.rm(path.join(
			tmpdir, 
			path.dirname(resource).split('/')[0] // wowsunpack.exe uses forward slashes as separators, even on Windows
		), { recursive: true, force: true })),
		// For some bizarre reason, GameParams.data is reversed...
		buffer => buffer.reverse(),
		// Decompress using zlib
		buffer => decompress(buffer),
		// Turn into a string using latin-1 encoding
		buffer => buffer.toString('latin1'),
		// Unpickle. This turns it from a byte string into a Javascript object
		gpd => pickle.loads(gpd),
		// GameParams are an array with two members:
		// - first, the actual game params definitions
		// - second, a set of what appears to be numeric IDs. Maybe these are the IDs of all game objects that are "active" in the game, as 
		//   opposed to being included for legacy reasons.
		// For the time being, project to the definitions.
		gpd => gpd[0],
		passthrough(each(gameObject => Object.values(invariants).filter(imported => typeof imported === 'function').forEach(invariant => invariant(gameObject)))),
		writeJSON(path.join(dest, 'GameParams.json'))
	]);
}