import Modifier from './modifier.js';
import GameObject from './gameobject.js';

/** 
 * Signal flags can be hoisted on ships to provide bonuses in combat.
 */
export default class Signal extends GameObject {
	/**
	 * Gets `Modifier` objects for the changes this signal makes.
	 *
	 * @return {Modifier[]} Modifiers for the modifications this signal makes. 
	 * @see Modifier
	 */
	getModifiers() {
		let modifiers = this._data.modifiers;
		return Object.keys(modifiers)
					.flatMap(key => Modifier.from(key, modifiers[key]))
					.filter(modifier => modifier.target !== undefined && modifier.target !== null);
	}	
}