import { GameObject } from './gameobject.js';

/**
 * This class models a ship ability - called "consumable" in game.
 * 
 * @see Ability.gamedata
 */
class Consumable extends GameObject {

	#flavor;

	/**
	 * Sets the flavor that defines the characteristics of this consumable.
	 * 
	 * @param {Object} flavor The flavor to set.
	 */
	setFlavor(flavor) {
		if (typeof this[flavor] !== 'object')
			throw new Error(`Trying to set unknown flavor ${flavor} on consumable ${this.name}`);
				
		this.#flavor = flavor;
		let properties = Object.getOwnPropertyDescriptors(this[this.#flavor]);
		for (let name in properties) {
			let property = properties[name];
			property.get = function() { return this[this.#flavor][name] }
			property.set = function(val) { console.log(this); this[this.#flavor][name] = val; }
			delete property.value;
			delete property.writable;
		}
		Object.defineProperties(this, properties);
	}

	isType(type) {
		return this.get('consumableType') === type;
	}

	// /**
	//  * Reads through to the set flavor except for typeinfo.*, name, index and id.
	//  * @throws
	//  * Throws an error if trying to read through before a flavor is set.
	//  * @override
	//  */
	// get(key, options) {
	// 	// key might be in dot notation, so we need check against only the first part
	// 	// If the first part is typeinfo, name, index or id, read it from this object
	// 	// Otherwise read through to the flavor
	// 	if (!['typeinfo', 'name', 'index', 'id'].includes(key.split('.')[0]))
	// 		if (!this.#flavor)
	// 			throw new Error(`Trying to get property ${key} on consumable ${this.name} while no flavor is set`);
	// 		else
	// 			key = this.#flavor + '.' + key;
		
	// 	return super.get(key, options);
	// }

}

export { Consumable }