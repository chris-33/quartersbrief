import { GameObject } from './gameobject.js';
import { Modifier } from '../util/modifier.js';
import { Ship } from './ship.js';

// PCEC001

/**
 * Camouflages are skins that can be mounted on ships. Aside from changing their visual appearance, camouflages also
 * grant certain bonuses. Camouflages can either be permanent ("permoflages") or expendable. While expendable camouflages
 * are mountable on any ship, permoflages are only mountable on some. 
 */
class Camouflage extends GameObject {

	/**
	 * Checks whether the `ship` is eligible for mounting this camouflage. 
	 * An expendable camouflage can be mounted on any ship. A permanent camouflage can only be mounted on a ship
	 * if it is listed as a valid camouflage by that ship, as per {@link Ship#getPermoflages}.
	 * @param  {Ship} ship The ship for which to check.
	 * @return {[type]}      `True` if `ship` can mount this camouflage, `false` otherwise.
	 * @throws Throws a `TypeError` if `ship` is not a `Ship`.
	 */
	eligible(ship) {
		Ship.errorIfNotShip(ship);
		
		if (!this.isPermoflage()) return true;

		let permoflages = ship.getPermoflages();
		return permoflages.some(permoflage => permoflage.getID() === this.getID());
	}

	/**
	 * Whether this camouflage is a permanent camouflage ("permoflage") or an expendable one.
	 * @return {boolean} `True` if this camouflage is a permanent camouflage, `false` if it is an expendable one.
	 */
	isPermoflage() {
		return this.get('typeinfo.species') === 'Permoflage';
	}

	/**
	 * Gets `Modifier` objects for the changes this camouflage makes.
	 *
	 * @return {Modifier[]} Modifiers for the modifications this camouflage makes. 
	 * @see Modifier
	 */
	getModifiers() {
		let self = this;
		let modifiers = self.get('modifiers');
		return Object.keys(modifiers)
					.map(key => Modifier.from(key, self.modifiers[key]))
					.filter(modifier => modifier.target !== undefined && modifier.target !== null);
	}

}

export { Camouflage }