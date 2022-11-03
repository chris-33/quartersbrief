import { GameObject } from './gameobject.js';
import DotNotation from '../util/dotnotation.js';

/**
 * This class models a ship ability - called "consumable" in game.
 * 
 * @see Ability.gamedata
 */
class Consumable extends GameObject {
	static EXPOSED_FLAVOR_PROPERTIES = [
		'consumableType',
		'label',
		'distShip',
		'workTime',
		'reloadTime',
		'numConsumables',
		'torpedoReloadTime' // Torpedo Reload Booster
	];

	#flavor;

	/**
	 * Sets the flavor that defines the characteristics of this consumable.
	 * 
	 * @param {Object} flavor The flavor to set.
	 */
	setFlavor(flavor) {
		if (typeof this._data[flavor] !== 'object')
			throw new Error(`Trying to set unknown flavor ${flavor} on consumable ${this.getName()}`);

		for (let key of Consumable.EXPOSED_FLAVOR_PROPERTIES) {
			// Delete any previously set exposed properties
			if (key in this) 
				delete this[key];
			// Expose any properties that are in the set flavor
			if (key in this._data[flavor]) {
				Object.defineProperty(this, key, {
					get: () => this._data[this.#flavor][key],
					set: val => { this._data[this.#flavor][key] = val },
					enumerable: true,
					configurable: true
				});
			}
		}
				
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
		let path = DotNotation.elements(key);
		if (Consumable.EXPOSED_FLAVOR_PROPERTIES.includes(path[0])) {
			if (!this.#flavor)
				throw new Error(`Trying to get property ${key} on consumable ${this.getName()} while no flavor is set`);
			path.unshift(this.#flavor);
		}

		return super.get(DotNotation.join(path), options);
	}

	apply(key, func, options) {
		if (!this.#flavor)
			throw new Error(`Trying to apply function on property ${key} on consumable ${this.getName()} while no flavor is set`);
		else
			key = this.#flavor + '.' + key;
		return super.apply(key, func, options);		
	}

	get consumableType() { return this.get('consumableType'); }

	getLabel() { return this.get('label'); }
}

export { Consumable }