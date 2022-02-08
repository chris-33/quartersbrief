import { arrayDifference } from './util.js';
import { Ship } from '../model/ship.js';

/**
 * This class describes a single modification to be carried out on a ship's characteristic. 
 * A modifier consists of a target, a retriever and an applicator. 
 *
 * The _target_ is the name of the ship's property that is to be changed by this modifier. 
 *
 * The _retriever_ is a function that gets called with the ship and the value from the raw data
 * and returns a value as appropriate for that ship. Modifier has two pre-made retriever functions 
 * available that are sufficient for most use cases: 
 * - The _simple retriever_ simply returns the value.
 * - The _species retriever_ works on values that are maps of species to values. It returns the
 * value that matches the ship's species.
 * The signature of a retriever function is `function(value, ship)`.
 *
 * Finally, an _applicator_ is a function that describes how to apply the retrieved value to the
 * ship's target property. The default is to multiply. 
 */
class Modifier {

	/**
	 * A dictionary translating modifier keys (the names found in the upgrade's game data) to
	 * their corresponding keys in the ship to be modified. Each entry consists of a **target**, 
	 * and a **retriever** function to retrieve it's value.
	 * The retriever function will be called when equipping this modernization with `this` being
	 * the modernization with the value from the game file and the ship the modernization is being
	 * equipped on as arguments.
	 */
	static DEFINITIONS = {
		// @todo GMRotationSpeed:  // PCM006_MainGun_Mod_II, PCM013_MainGun_Mod_III, PCM034_Guidance_Mod_0
		// @todo AAAuraDamage // PCM011_AirDefense_Mod_II
		// @todo AABubbleDamage // PCM011_AirDefense_Mod_II
		GSMaxDist: 'atba.maxDist', // PCM012_SecondaryGun_Mod_II, PCM028_FireControl_Mod_I_US
		GMShotDelay: 'artillery.qb_mounts.shotDelay', // PCM013_MainGun_Mod_III
		GMMaxDist: 'artillery.maxDist', // PCM015_FireControl_Mod_II, PCM028_FireControl_Mod_I_US
		GSShotDelay: 'atba.qb_mounts.shotDelay', // PCM019_SecondaryGun_Mod_III
		planeVisibilityFactor: 'hull.visibilityFactorByPlane', // PCM027_ConcealmentMeasures_Mod_I
		visibilityDistCoeff: { target: 'hull.visibilityFactor', retriever: Modifier.SPECIES_RETRIEVER } // PCM027_ConcealmentMeasures_Mod_I				
	
		// Everything up to PCM035_SteeringGear_Mod_III
	}

	/** 
	 * The default retriever function is the identity function - it just returns its argument. 
	 * (Which will be the value from the game file.)
	 * This is the default.
	 */
	static SIMPLE_RETRIEVER = (x) => x;
	/**
	 * A retriever that works on values that are maps of the form species -> value, and returns
	 * the value that for the `ship`'s species.
	 */
	static SPECIES_RETRIEVER = (x, ship) => x[ship.getSpecies];
	/**
	 * An applicator function that multiplies the original value with the value from the retriever.
	 * This is the default.
	 */
	static MULTIPLY = (a, b) => a * b;

	constructor(target, retriever, applicator) {
		if (typeof target !== 'string') throw new TypeError(`Expected target to be a string but it was ${target}`);
		if (retriever && typeof retriever !== 'function') throw new TypeError(`Expected retriever to be a function but it was ${retriever}`);
		if (applicator && typeof applicator !== 'function') throw new TypeError(`Èxpected applicator to be a function but it was ${applicator}`);
		
		this.target = target;
		this.retriever = retriever ?? Modifier.SIMPLE_RETRIEVER;
		this.applicator = applicator ?? Modifier.MULTIPLY;
	}

	applyTo(ship) {
		if (!(ship instanceof Ship)) throw new TypeError(`Expected a ship but got a ${ship.constructor}`);

		ship.apply(this.target, this.applicator.bind(null, this.retriever(ship)), { collate: false });
	}

	static from(key, data) {
		let definition = Modifier.DEFINITIONS[key];
		let target = definition.target;
		let value = data;
		let retriever = Modifier.SIMPLE_RETRIEVER.bind(null, data);
		// Try to infer type of retriever
		// It is probably the SPECIES_RETRIEVER if the data is an object that has only the keys cruiser, destroyer, etc.
		if (typeof data === 'object' && 
				arrayDifference(Object.keys(data).map(String.toLowerCase), ['cruiser', 'destroyer', 'battleship', 'aircarrier', 'submarine']).length === 0) {
			retriever = Modifier.SPECIES_RETRIEVER.bind(null, data);
		}
		
		return new Modifier(target, value, retriever, Modifier.MULTIPLY.bind(null, value));
	}
}

export { Modifier }