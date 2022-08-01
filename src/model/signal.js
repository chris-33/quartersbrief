import { Modifier } from './modifier.js';
import { GameObject } from './gameobject.js';

/** 
 * Signal flags can be hoisted on ships to provide bonuses in combat.
 */
export class Signal extends GameObject {
	/**
	 * Gets `Modifier` objects for the changes this signal makes.
	 *
	 * @return {Modifier[]} Modifiers for the modifications this signal makes. 
	 * @see Modifier
	 */
	getModifiers() {
		let modifiers = this.get('modifiers');
		return Object.keys(modifiers)
					.map(key => Modifier.from(key, modifiers[key]))
					.filter(modifier => modifier.target !== undefined && modifier.target !== null);
	}	
}