import DataObject from './dataobject.js';
/**
 * This is a thin wrapper around game object definitions as they can be read from
 * `GameParams.data`. 
 *
 * All game objects have a `name`, `index`, and `id` property, as well as a `typeinfo` 
 * object.
 */
export default class GameObject extends DataObject {
	/**
	 * Regex to find game object reference codes.
	 * References all start with the capital letter P, followed
	 * by two or three more capital letters and two to four digits. 
	 * 
	 * Example: PASC206, PAD049
	 * @type {RegExp}
	 */
	static REFERENCE_CODE_REGEX = new RegExp('^P[A-Z]{2,3}[0-9]{2,4}$');
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

	getID() { return this._data.id;	}
	getName() { return this._data.name; }
	getNation() { return this._data.typeinfo.nation; }
	getSpecies() { return this._data.typeinfo.species; }
	getType() { return this._data.typeinfo.type; }
	getLabel() { return this._data.label; }
	getRefCode() { return this._data.index; }
	getTypeInfo() { return this._data.typeinfo; }
}