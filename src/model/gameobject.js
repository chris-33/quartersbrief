import clone from 'just-clone';
import { AccessorMixin } from '../util/accessors.js';
import { autocreate } from '../util/autocreate-getters.js';

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
class GameObject extends AccessorMixin(null) {
	/**
	 * Definitions for autocreated getters
	 */
	static #LOOKUP_DEFINITIONS = {
		Name: 'name',
		Refcode: 'index',
		Index: 'index', // Alias
		ID: 'id',
		TypeInfo: 'typeinfo',
		Type: 'typeinfo.type'
	};

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
		super();		
		let self = this;

		// Copy over everything from data
		Object.assign(self, clone(data));

		autocreate(self, GameObject.#LOOKUP_DEFINITIONS);
	}
}

export { GameObject }