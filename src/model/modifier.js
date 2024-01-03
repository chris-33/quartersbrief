import Ship from '../model/ship.js';

/**
 * This class describes a single modification to be carried out on a ship's characteristic. 
 * A modifier in its simplest form consists of a _target_ and a _value_. 
 *
 * The _target_ is the name of the ship's property that is to be changed by this modifier. 
 *
 * The _value_ is a factor that the targeted property's current value will be multiplied with. 
 * A value can either be a primitive, in which case it is expected to be a number, or an object,
 * in which it is considered to be a mapping of ship species to numbers. 
 *
 * In a more complex form, a modifier can also have a _calculation function_ and a _mode_. 
 * 
 * The _calculation function_ is a function that is called when the modifier is applied and determines 
 * the actual value to be used. For this, it gets passed the ship the modifier is being applied on and the
 * base value the modifier was constructed with, and must return the actual value. The default behavior is
 * to return the base value unless it is an object with a property named after the ship's class, in which case
 * it returns the value of that property.
 * This allows to change the value from its base value before it gets applied. This can be useful in cases where the 
 * modifier value depends on certain characteristics of the ship: For example, the Basics of Survivability skill depends 
 * on the tier of the ship.
 *
 * The _mode_ describes the way the value is to be applied to the target. The default is `'multiply'`,
 * but it can also be `'add'` or `'set'`.
 */
export default class Modifier {
	static DEFAULT_DESCRIPTOR = {
		calc: (ship, baseValue) => 
			typeof baseValue === 'object' && ship.class in baseValue ? 
			baseValue[ship.class] : 
			baseValue,
		mode: 'multiply'
	}

	/**
	 * A dictionary translating modifier keys (the names found in the upgrade's game data) to
	 * their corresponding keys in the ship to be modified. 
	 *
	 * This can either be a string in dot notation, or an array of strings in dot notation that the 
	 * modifier will be applied to. The string form is just a convenience notation for an array containing
	 * only that string.
	 */
	static KNOWN_TARGETS = {
		floodChanceFactor: 'torpedoes.mounts.*.ammos.*.floodChance', // Skill 60 Liquidator, PCEF017_VL_SignalFlag, PCEF019_JW1_SignalFlag
		// @todo GMRotationSpeed:  // PCM006_MainGun_Mod_II, PCM013_MainGun_Mod_III, PCM034_Guidance_Mod_0
		// @todo AAAuraDamage // PCM011_AirDefense_Mod_II
		// @todo AABubbleDamage // PCM011_AirDefense_Mod_II
		GSMaxDist: 'atba.maxDist', // PCM012_SecondaryGun_Mod_II, PCM028_FireControl_Mod_I_US
		GMShotDelay: 'artillery.mounts.*.shotDelay', // PCM013_MainGun_Mod_III
		GMMaxDist: 'artillery.maxDist', // PCM015_FireControl_Mod_II, PCM028_FireControl_Mod_I_US
		GMPenetrationCoeffHE: 'artillery.mounts.*.ammoList.*.alphaPiercingHE', // Skill 33 HePenetration
		GSShotDelay: 'atba.mounts.*.shotDelay', // PCM019_SecondaryGun_Mod_III
		GTShotDelay: 'torpedoes.mounts.*.reload', // PCM014_Torpedo_Mod_III, PCM057_Special_Mod_I_Shimakaze, PCM075_Special_Mod_I_Daring, Skill 4 Fill the Tubes
		// @todo planeVisibilityFactor isn't the visibility BY plane, it's the visibility OF the planes
		// planeVisibilityFactor: 'hull.visibilityFactorByPlane', // PCM027_ConcealmentMeasures_Mod_I
		visibilityDistCoeff: [ // PCM027_ConcealmentMeasures_Mod_I, Skill 12 DetectionVisibilityRange
			'hull.concealment.sea', 
			'hull.concealment.air' 
		], 
		torpedoDamageCoeff: 'torpedoes.mounts.*.ammos.*.damage', // Skill 30 Enhanced Torpedo Explosive Charge
		torpedoSpeedMultiplier: 'torpedoes.mounts.*.ammos.*.speed', // PCM070_Torpedo_Mod_IV, Skill 24 Swift Fish
		sonarWorkTimeCoeff: 'consumables.sonar.workTime', // PCM041_SonarSearch_Mod_I, Skill 6 ConsumablesDuration
		rlsWorkTimeCoeff: 'consumables.rls.workTime', // PCM042_RLSSearch_Mod_I, Skill 6 ConsumablesDuration
		ConsumablesWorkTime: 'consumables.*.workTime', // PCM072_AbilityWorktimeBoost_Mod_I
		// Everything up to PCM035_SteeringGear_Mod_III
		visibilityFactor: 'hull.visibilityFactor', // Camouflages
		healthPerLevel: { // Skill 25 DefenseHp
			target: 'hull.health',
			calc: (ship, baseValue) => ship.tier * Modifier.DEFAULT_DESCRIPTOR.calc(ship, baseValue),
			mode: 'add'
		},
	}

	/**
	 * Construct a new `Modifier` that, when applied, will set the property name `target` 
	 * to the provided value. `value` must either be a number or an object. `target` may
	 * be undefined or `null`, in which case this modifier simply will have no effect when
	 * applied. Otherwise, however, it must be a string.
	 *
	 * A `calc` function and `mode` may optionally be passed. If they are not, the values of the
	 * `Modifier.DEFAULT_DESCRIPTOR` are used.
	 * @param  {string} target The name of the target property to be modified.
	 * @param  {number|Object} value  The factor with which to multiply the target property's
	 * value when this modifier is applied.
	 * @param {Function} [calc] The calc function to be used. It must be a function `(ship, baseValue) => actualValue`
	 * @param {String} [mode] The way this modifier will be applied.
	 */
	constructor(target, value, calc, mode) {
		if (target !== undefined && target !== null && typeof target !== 'string') // Do allow to target to be undefined or null. In this case, we just won't do anything when applying
			throw new TypeError(`Expected target to be a string but it was ${target}`);
		if (typeof value !== 'number' && typeof value !== 'object')
			throw new TypeError(`Expected value to be a number or an object but it was ${value}`);
		
		this.target = target;
		this.value = value;

		this.calc = calc ? calc : Modifier.DEFAULT_DESCRIPTOR.calc;
		this.mode = mode ? mode : Modifier.DEFAULT_DESCRIPTOR.mode;
	}

	/**
	 * Returns a new modifier that has the same target but the inverse value of this modifier. Applying 
	 * that modifier will negate the effects of this modifier.
	 * @return {Modifier} A `Modifier` that will negate the effects of the modifier that `invert` was 
	 * called on.
	 */
	invert() {
		let calc;
		switch (this.mode) {
			case 'multiply': calc = (ship, baseValue) => 1 / this.calc(ship, baseValue); break;
			case 'add': calc = (ship, baseValue) => -this.calc(ship, baseValue); break;
			case 'set': throw new Error(`Cannot invert a modifier in 'set' mode`);
			default: throw new TypeError(`Unknown mode ${this.mode}`);
		}
		return new Modifier(this.target, this.value, calc, this.mode);
	}

	/**
	 * Applies this modifier to the given `ship`. If this modifier's `value` is an object, the value
	 * for the `ship`'s species will be used. It is not an error for the modifier's target to be 
	 * undefined or `null`, in this case this method just has no effect.
	 * @param  {Ship} ship    The ship to be modified.
	 * @param  {Object} [options] An options object to be passed to {@link DatObject#multiply} when carrying
	 * out the modification. The default is `{ collate: false }`, which is different from the default.
	 * @throws Throws a `TypeError` if `ship` is not a `Ship`, or if the `value` is not a number.
	 */
	applyTo(ship, options) {
		if (!this.target) return;

		Ship.errorIfNotShip(ship);

		let value = this.calc(ship, this.value);
		if (typeof value !== 'number') throw new TypeError(`Modifier value was not a number: ${value}`);

		ship[this.mode].call(ship, this.target, value, options ?? { collate: false });
	}

	/** 
	 * Constructs a `Modifier` object whose `target` is the result of looking up the `key` in the list of
	 * well-known targets {@link Modifier#KNOWN_TARGETS} and whose value is `data`.
	 */
	static from(key, data) {
		let targets = Modifier.KNOWN_TARGETS[key];
		if (!Array.isArray(targets)) targets = [ targets ];

		return targets.map(target => 
			typeof target === 'string' || target == undefined ? 
			new Modifier(target, data) :
			new Modifier(target.target, data, target.calc, target.mode));
	}
}