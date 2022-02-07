import { GameObject } from './gameobject.js';
import { Ship } from './ship.js';
import { ComplexDataObject } from '../util/cdo.js';
import { arrayIntersect } from '../util/util.js';

/**
 * This class describes _Modernizations_. In game, these are called "upgrades".
 */
class Modernization extends GameObject {
	
	static #GETTER_DEFINITIONS = {
		Tiers: 'shiplevel',
		Nations: 'nation',
		Species: 'shiptype',
		Blacklist: 'excludes',
		Whitelist: 'ships',
		Slot: 'slot'
	}

	/**
	 * A dictionary translating modifier keys (the names found in the upgrade's game data) to
	 * their corresponding keys in the ship to be modified. Each entry consists of a **target**, 
	 * and a **retriever** function to retrieve it's value.
	 * The retriever function will be called when equipping this modernization with `this` being
	 * the modernization with the value from the game file and the ship the modernization is being
	 * equipped on as arguments.
	 */
	static MODERNIZATION_TARGETS = {
		// @todo GMRotationSpeed:  // PCM006_MainGun_Mod_II, PCM013_MainGun_Mod_III, PCM034_Guidance_Mod_0
		// @todo AAAuraDamage // PCM011_AirDefense_Mod_II
		// @todo AABubbleDamage // PCM011_AirDefense_Mod_II
		GSMaxDist: { target: 'atba.maxDist', retriever: Modernization.DEFAULT_RETRIEVER }, // PCM012_SecondaryGun_Mod_II, PCM028_FireControl_Mod_I_US
		GMShotDelay: { target: 'artillery.qb_mounts.shotDelay', retriever: Modernization.DEFAULT_RETRIEVER }, // PCM013_MainGun_Mod_III
		GMMaxDist: { target: 'artillery.maxDist', retriever: Modernization.DEFAULT_RETRIEVER }, // PCM015_FireControl_Mod_II, PCM028_FireControl_Mod_I_US
		GSShotDelay: { target: 'atba.qb_mounts.shotDelay', retriever: Modernization.DEFAULT_RETRIEVER }, // PCM019_SecondaryGun_Mod_III
		planeVisibilityFactor: { target: 'hull.visibilityFactorByPlane', retriever: Modernization.DEFAULT_RETRIEVER }, // PCM027_ConcealmentMeasures_Mod_I
		visibilityDistCoef: { target: 'hull.visibilityFactor', retriever: function(value, ship) { // PCM027_ConcealmentMeasures_Mod_I
			return value[ship.getSpecies()];
		}}
	
		// Everything up to PCM035_SteeringGear_Mod_III
	}
	/** 
	 * The default retriever function is the identity function - it just returns its argument. 
	 * (Which will be the value from the game file.)
	 */
	static DEFAULT_RETRIEVER = (x) => x;

	constructor(data) {
		super(data);

		ComplexDataObject.createGetters(this, Modernization.#GETTER_DEFINITIONS);
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
		let self = this;

		if (!(ship instanceof Ship))
			throw new TypeError('Modernizations can only be applied to ships');		

		// If slot is -1, that means the modernization has been removed from the game.
		if (self.getSlot() === -1) return false;
		// If the ship is whitelisted, return true no matter what
		if (self.getWhitelist().includes(ship.getName())) return true;
		// If the ship is blacklisted, return false no matter what
		if (self.getBlacklist().includes(ship.getName())) return false;

		// Otherwise apply the standard tier+type+nation logic
		return (self.getTiers().length === 0 || self.getTiers().includes(ship.getTier()))
			&& (self.getSpecies().length === 0 || self.getSpecies().includes(ship.getSpecies()))
			&& (self.getNations().length === 0 || self.getNations().includes(ship.getNation()));
	}

	/**
	 * Gets descriptors for the modifications that this upgrade makes. A descriptor is object
	 * consisting of a `target` and a `value`.
	 *
	 * The `target` is a key within the ship to be modified that this upgrade will change.
	 * The `value` is the amount by which it is to be changed. 
	 * @return {[type]} [description]
	 */
	getModifiers() {
		let self = this;
		// Reduce this modernization's modifiers to the ones we know how to handle
		let result = arrayIntersect(Object.keys(self.modifiers), Object.keys(Modernization.MODERNIZATION_TARGETS));
		result = result.map(modifier => ({ 
			target: Modernization.MODERNIZATION_TARGETS[modifier].target,
			retriever: Modernization.MODERNIZATION_TARGETS[modifier].retriever.bind(self, self.modifiers[modifier])
		}));
		return result;
	}

	applyTo(ship) {
		if (!(ship instanceof Ship))
			throw new TypeError(`Expected a ship but got ${ship}`);

		
	}
}

/**
 * @name Modernization#getTiers
 * @function
 * @memberof Modernization
 * @description Get the tiers that are eligible for this modernization.
 * An empty result means all tiers are eligible.
 * @return {Array} An array of the tiers that are eligible.
 */

/**
 * @name Modernization#getNations
 * @function
 * @memberof Modernization
 * Get the nations that are eligible for this modernization.
 * An empty result means all nations are eligible.
 * @return {Array} An array of the nations that are eligible.
 */

/**
 * @name Modernization#getSpecies
 * @function
 * @memberof Modernization
 * Get the ship species (BB, DD, ...) that are eligible for this modernization.
 * An empty result means all ship species are eligible.
 * @return {Array} An array of the ship species that are eligible.
 */


export { Modernization }