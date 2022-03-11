import { Ship } from '../model/ship.js';

/**
 * This class describes a single modification to be carried out on a ship's characteristic. 
 * A modifier consists of a _target_ and a _value_. 
 *
 * The _target_ is the name of the ship's property that is to be changed by this modifier. 
 *
 * The _value_ is a factor that the targeted property's current value will be multiplied with. 
 * A value can either be a primitive, in which case it is expected to be a number, or an object,
 * in which it is considered to be a mapping of ship species to numbers. 
 */
class Modifier {

	/**
	 * A dictionary translating modifier keys (the names found in the upgrade's game data) to
	 * their corresponding keys in the ship to be modified. 
	 */
	static KNOWN_TARGETS = {
		// @todo GMRotationSpeed:  // PCM006_MainGun_Mod_II, PCM013_MainGun_Mod_III, PCM034_Guidance_Mod_0
		// @todo AAAuraDamage // PCM011_AirDefense_Mod_II
		// @todo AABubbleDamage // PCM011_AirDefense_Mod_II
		GSMaxDist: 'atba.maxDist', // PCM012_SecondaryGun_Mod_II, PCM028_FireControl_Mod_I_US
		GMShotDelay: 'artillery.qb_mounts.shotDelay', // PCM013_MainGun_Mod_III
		GMMaxDist: 'artillery.maxDist', // PCM015_FireControl_Mod_II, PCM028_FireControl_Mod_I_US
		GSShotDelay: 'atba.qb_mounts.shotDelay', // PCM019_SecondaryGun_Mod_III
		planeVisibilityFactor: 'hull.visibilityFactorByPlane', // PCM027_ConcealmentMeasures_Mod_I
		visibilityDistCoeff: 'hull.visibilityFactor', // PCM027_ConcealmentMeasures_Mod_I				
	
		// Everything up to PCM035_SteeringGear_Mod_III
		visibilityFactor: 'hull.visibilityFactor', // Camouflages
	}

	/**
	 * Construct a new `Modifier` that, when applied, will set the property name `target` 
	 * to the provided value. `value` must either be a number or an object. `target` may
	 * be undefined or `null`, in which case this modifier simply will have no effect when
	 * applied. Otherwise, however, it must be a string.
	 * @param  {string} target The name of the target property to be modified.
	 * @param  {number|Object} value  The factor with which to multiply the target property's
	 * value when this modifier is applied.
	 */
	constructor(target, value) {
		if (target !== undefined && target !== null && typeof target !== 'string') // Do allow to target to be undefined or null. In this case, we just won't do anything when applying
			throw new TypeError(`Expected target to be a string but it was ${target}`);
		if (typeof value !== 'number' && typeof value !== 'object')
			throw new TypeError(`Expected value to be a number or an object but it was ${value}`);

		this.target = target;
		this.value = value;
	}

	/**
	 * Returns a new modifier that has the same target but the inverse value of this modifier. Applying 
	 * that modifier will negate the effects of this modifier.
	 * @return {Modifier} A `Modifier` that will negate the effects of the modifier that `invert` was 
	 * called on.
	 */
	invert() {
		return new Modifier(this.target, 1 / this.value);
	}

	/**
	 * Applies this modifier to the given `ship`. If this modifier's `value` is an object, the value
	 * for the `ship`'s species will be used. It is not an error for the modifier's target to be 
	 * undefined or `null`, in this case this method just has no effect.
	 * @param  {Ship} ship    The ship to be modified.
	 * @param  {Object} [options] An options object to be passed to {@link CDO#multiply} when carrying
	 * out the modification. The default is `{ collate: false }`, which is different from the default.
	 * @throws Throws a `TypeError` if `ship` is not a `Ship`, or if the `value` is not a number.
	 */
	applyTo(ship, options) {
		if (!this.target) return;

		Ship.errorIfNotShip(ship);

		let value = this.value;
		if (typeof value === 'object' && ship.getSpecies() in this.value)
			value = value[ship.getSpecies()];
		if (typeof value !== 'number') throw new TypeError(`Modifier value was not a number: ${value}`);

		ship.multiply(this.target, value, options ?? { collate: false });
	}

	/** 
	 * Constructs a `Modifier` object whose `target` is the result of looking up the `key` in the list of
	 * well-known targets {@link Modifier#KNOWN_TARGETS} and whose value is `data`.
	 */
	static from(key, data) {
		let target = Modifier.KNOWN_TARGETS[key];

		return new Modifier(target, data);
	}
}

export { Modifier }