import DotNotation from '../util/dot-notation.js';
import deepequal from 'deep-equal';

/**
 * This is a thin wrapper around game object definitions as they can be read from
 * `GameParams.data`. 
 *
 * `GameObject` provides easy access to even nested and array properties using dot
 * notation. {@link #get}
 *
 * All game objects have a `name`, `index`, and `id` property, as well as a `typeinfo` 
 * object. (This is checked at application startup through invariant assertion checking.)
 */
class GameObject {
	/**
	 * Regex to find game object reference codes.
	 * References all start with the capital letter P, followed
	 * by two or three more capital letters and three digits. 
	 * 
	 * Example: PASC206, PAD049
	 * @type {RegExp}
	 */
	static REFERENCE_CODE_REGEX = new RegExp('^P[A-Z]{2,3}[0-9]{2,3}$');
	/**
	 * Regex to find reference names. A reference name is either just a
	 * reference code, or a reference code follwoed by an underscore and at least one 
	 * character.
	 *
	 * Example: PASC206_Dallas (note that PASC206 - the reference code - is also a valid
	 * reference name)
	 * @type {RegExp}
	 */
	static REFERENCE_NAME_REGEX = new RegExp(GameObject.REFERENCE_CODE_REGEX.source.slice(0,-1) + '(?:_\\w+)?$');

	/**
	 * Creates a new GameObject and copies all properties
	 * from data to it.
	 * @param  {Object} data The source to copy from
	 */
	constructor(data) {
		this._data = data;
	}

	get(key, options) {		
		options ??= {};
		options.collate ??= !new DotNotation.Key(key).isComplex();
		let dotnotation = new DotNotation(this._data);		
		let result = dotnotation.resolveToParents(key);
		result = result.flatMap(item => dotnotation.resolveStep(new DotNotation.Key(key).prop, item));

		if (options.collate) {
			if (!result.every(target => deepequal(target, result[0])))
				throw new Error(`Expected all values to be equal while collating but they were not: ${result}`);
			// We can just project to the first item, since we just checked that they're all equal anyway
			result = result[0];
		}
		return result;
	}

	multiply(key, factor) {
		let dotnotation = new DotNotation(this._data);
		let targets = dotnotation.resolveToParents(key);
		targets.forEach(target => dotnotation.applyFn(new DotNotation.Key(key).prop, x => factor * x, target));
	}

	getID() { return this._data.id;	}
	getName() { return this._data.name; }
	getNation() { return this._data.typeinfo.nation; }
	getSpecies() { return this._data.typeinfo.species; }
	getType() { return this._data.typeinfo.type; }
	getLabel() { return this._data.label; }
	getRefCode() { return this._data.index; }
	getTypeInfo() { return this._data.typeinfo; }
}

export { GameObject }