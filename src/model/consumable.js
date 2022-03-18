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
		if (typeof this._data[flavor] !== 'object')
			throw new Error(`Trying to set unknown flavor ${flavor} on consumable ${this.getName()}`);
				
		this.#flavor = flavor;
	}

	isType(type) {
		return this.get('consumableType') === type;
	}

	/**
	 * Reads through to the set flavor except for typeinfo.*, name, index and id.
	 * @throws
	 * Throws an error if trying to read through before a flavor is set.
	 * @override
	 */
	get(key, options) {
		// key might be in dot notation, so we need check against only the first part
		// If the first part is typeinfo, name, index or id, read it from this object
		// Otherwise read through to the flavor
		if (!['typeinfo', 'name', 'index', 'id'].includes(key.split('.')[0]))
			if (!this.#flavor)
				throw new Error(`Trying to get property ${key} on consumable ${this.getName()} while no flavor is set`);
			else
				key = this.#flavor + '.' + key;

		return super.get(key, options);
	}

	multiply(key, factor, options) {
		if (!this.#flavor)
			throw new Error(`Trying to multiply property ${key} on consumable ${this.getName()} while no flavor is set`);
		else
			key = this.#flavor + '.' + key;
		return super.multiply(key, factor, options);
	}

	get consumableType() { return this.get('consumableType'); }
}

export { Consumable }