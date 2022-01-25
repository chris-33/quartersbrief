var GameObject = require('$/src/model/gameobject');
var Ship = require('$/src/model/ship');

const KEYS = {
	TIERS: 'shiplevel',
	NATIONS: 'nation',
	SHIPTYPES: 'shiptype',
	BLACKLIST: 'excludes',
	WHITELIST: 'ships',
};

/**
 * This class describes _Modernizations_. In game, these are called "modules".
 */
class Modernization extends GameObject {
	constructor(data) {
		super(data);
	}


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
		var self = this;

		if (!(ship instanceof Ship))
			throw new TypeError('Modernizations can only be applied to ships');
		var name = ship.getName();

		// If the ship is whitelisted, return true no matter what
		if (self.getWhitelist().includes(ship.getName())) return true;
		// If the ship is blacklisted, return false no matter what
		if (self.getBlacklist().includes(ship.getName())) return false;

		// Otherwise apply the standard tier+type+nation logic
		return (self.getTiers().length === 0 || self.getTiers().includes(ship.getTier()))
			&& (self.getShipTypes().length === 0 || self.getShipTypes().includes(ship.getType()))
			&& (self.getNations().length === 0 || self.getNations().includes(ship.getNation()));
	}

	/**
	 * Get the tiers that are eligible for this modernization.
	 * An empty result means all tiers are eligible.
	 * @return {Array} An array of the tiers that are eligible.
	 */
	getTiers() { return this.get(KEYS.TIERS); }
	/**
	 * Get the nations that are eligible for this modernization.
	 * An empty result means all nations are eligible.
	 * @return {Array} An array of the nations that are eligible.
	 */
	getNations() { return this.get(KEYS.NATIONS); }
	/**
	 * Get the ship types that are eligible for this modernization.
	 * An empty result means all ship types are eligible.
	 * @return {Array} An array of the ship types that are eligible.
	 */
	getShipTypes() { return this.get(KEYS.SHIPTYPES); }
	getBlacklist() { return this.get(KEYS.BLACKLIST); }
	getWhitelist() { return this.get(KEYS.WHITELIST); }

}

module.exports = Modernization;