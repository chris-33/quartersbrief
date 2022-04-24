import { GameObject } from './gameobject.js';
import { Ship } from './ship.js';
import { Modifier } from './modifier.js';

/**
 * This class describes _Modernizations_. In game, these are called "upgrades".
 *
 * @see Modernization.gamedata
 */
class Modernization extends GameObject {
	

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
		let self = this;

		Ship.errorIfNotShip(ship);

		// If slot is -1, that means the modernization has been removed from the game.
		if (self.getSlot() === -1) return false;
		// If the ship is whitelisted, return true no matter what
		if (self.getWhitelist().includes(ship.getName())) return true;
		// If the ship is blacklisted, return false no matter what
		if (self.getBlacklist().includes(ship.getName())) return false;

		// Otherwise apply the standard tier+type+nation logic
		return (self.getTiers().length === 0 || self.getTiers().includes(ship.getTier()))
			&& (self.getShipTypes().length === 0 || self.getShipTypes().includes(ship.getSpecies()))
			&& (self.getNations().length === 0 || self.getNations().includes(ship.getNation()));
	}

	/**
	 * Gets `Modifier` objects for the changes this modernization makes.
	 *
	 * @return {Modifier[]} Modifiers for the modifications this modernization makes. 
	 * @see Modifier
	 */
	getModifiers() {
		let modifiers = this.get('modifiers');
		return Object.keys(modifiers)
					.map(key => Modifier.from(key, modifiers[key]))
					.filter(modifier => modifier.target !== undefined && modifier.target !== null);
	}

	equipOn(ship) {
		Ship.errorIfNotShip(ship);
		
		ship.equipModernization(this);
	}

	/**
	 * Get the tiers that are eligible for this modernization.
	 * An empty result means all tiers are eligible.
	 * @return {Array} An array of the tiers that are eligible.
	 */
	getTiers() { return this._data.shiplevel; }
	/**
	 * Get the nations that are eligible for this modernization.
	 * An empty result means all nations are eligible.
	 * @return {Array} An array of the nations that are eligible.
	 */
	getNations() { return this._data.nation; }
	/**
	 * Get the ship classes (BB, DD, ...) that are eligible for this modernization.
	 * An empty result means all ship classes are eligible.
	 * @return {Array} An array of the ship classes that are eligible.
	 */
	getShipTypes() { return this._data.shiptype; }
	/**
	 * Get the list of ship reference names that are always considered ineligible, no matter their other properties.
	 * @return {Array} An array of the ships that are always ineligible.
	 */
	getBlacklist() { return this._data.excludes; }
	/**
	 * Get the list of ship reference names that are always considered eligible, no matter their other properties.
	 * @return {Array} An array of the ships that are always eligible.
	 */
	getWhitelist() { return this._data.ships; }
	getSlot() { return this._data.slot; }
}


export { Modernization }