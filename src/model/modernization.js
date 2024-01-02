import { expose } from './dataobject.js';
import GameObject from './gameobject.js';
import Ship from './ship.js';
import Modifier from './modifier.js';

/**
 * This class describes _Modernizations_. In game, these are called "upgrades".
 *
 * @see Modernization.gamedata
 */
export default class Modernization extends GameObject {
	

	/**
	 * Checks whether the passed ship is eligible for this modernization.
	 * A ship is eligible if it is in the lists of tiers, nations and
	 * types for this modernization. A ship is always eligible if it is
	 * whitelisted, and always ineligible if it is blacklisted, regardless
	 * of whether it would otherwise satisfy those criteria.
	 * @param  {Ship} ship The ship to check for eligibility
	 * @return {boolean}      Whether the ship qualifies for this modernization.
	 * @throws Throws a `TypeError` if the argument is not a `Ship`.
	 */
	eligible(ship) {
		Ship.errorIfNotShip(ship);

		// If slot is -1, that means the modernization has been removed from the game.
		if (this.slot === -1) return false;
		// If the ship is whitelisted, return true no matter what
		if (this.whitelist.includes(ship.name)) return true;
		// If the ship is blacklisted, return false no matter what
		if (this.blacklist.includes(ship.name)) return false;

		// Otherwise apply the standard tier+type+nation logic
		return (this.tiers.length === 0 || this.tiers.includes(ship.tier))
			&& (this.classes.length === 0 || this.classes.includes(ship.class))
			&& (this.nations.length === 0 || this.nations.includes(ship.nation));
	}

	/**
	 * Gets `Modifier` objects for the changes this modernization makes.
	 *
	 * @return {Modifier[]} Modifiers for the modifications this modernization makes. 
	 * @see Modifier
	 */
	getModifiers() {
		let modifiers = this._data.modifiers;
		return Object.keys(modifiers)
					.flatMap(key => Modifier.from(key, modifiers[key]))
					.filter(modifier => modifier.target !== undefined && modifier.target !== null);
	}

	equipOn(ship) {
		Ship.errorIfNotShip(ship);
		
		ship.equipModernization(this);
	}
}
expose(Modernization, {
	'tiers': 'shiplevel',
	'nations': 'nation',
	'classes': 'shiptype',
	'blacklist': 'excludes',
	'whitelist': 'ships',
	'slot': 'slot'
});