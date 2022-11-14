import GameObject from './gameobject.js';
import Ship from './ship.js';
import Modifier from './modifier.js';

export const SKILLS = {
	AA_DEFENSE_AND_ASW_EXPERT: 35,
	ADRENALINE_RUSH: 23,
	ADRENALINE_RUSH_SUB: 82, 
	AIR_SUPREMACY: 29, 
	AIRCRAFT_ARMOR: 10, 
	BASICS_OF_SURVIVABILITY: 2, 
	BOMBER_FLIGHT_CONTROL: 54, 
	BRISK: 61, 
	CLOSE_QUARTERS_COMBAT: 62, 
	CLOSE_QUARTERS_EXPERT: 41, 
	CONCEALMENT_EXPERT: 12, 
	CONSUMABLES_ENHANCEMENTS: 6,
	CONSUMABLES_ENHANCEMENTS_SUB: 74, 
	CONSUMABLES_SPECIALIST: 13,	
	CONSUMABLES_SPECIALIST_SUB: 80, 
	DAZZLE: 67,
	DEMOLITION_EXPERT: 8,
	DIRECTION_CENTER_FOR_FIGHTERS: 31, 
	EMERGENCY_REPAIR_EXPERT: 42, 
	EMERGENCY_REPAIR_SPECIALIST: 5,
	ENGINE_TECHIE: 32, 
	ENHANCED_AIRCRAFT_ARMOR: 53, 
	ENHANCED_ARMOR_PIERCING_AMMUNITION: 48, 
	ENHANCED_IMPULSE_GENERATOR: 69, 
	ENHANCED_REACTIONS: 50,
	ENHANCED_SONAR: 68, 
	ENHANCED_TORPEDO_EXPLOSIVE_CHARGE: 30,
	ENLARGED_PROPELLER_SHAFT: 78,
	EXTRA_HEAVY_AMMUNITION: 39, 
	EYE_IN_THE_SKY: 43,
	FEARLESS_BRALWER: 64, 
	FILL_THE_TUBES: 4,
	FIRE_PREVENTION_EXPERT: 14,
	FOCUS_FIRE_TRAINING: 27,
	FURIOUS: 81, 
	GREASE_THE_GEARS: 3,
	GUN_FEEDER: 21,
	HEAVY_AP_SHELLS: 38,
	HEAVY_HE_AND_SAP_SHELLS: 47,
	HELMSMAN: 79,
	HIDDEN_MENACE: 45, 
	IMPROVED_BATTERY_CAPACITY: 75, 
	IMPROVED_BATTERY_EFFICIENCY: 77, 
	IMPROVED_ENGINE: 16, 
	IMPROVED_ENGINE_BOOST: 11, 
	IMPROVED_REPAIR_PARTY_READINESS: 44, 
	INCOMING_FIRE_ALERT: 19,
	INERTIA_FUSE_FOR_HE_SHELLS: 33,
	INTERCEPTOR: 22, 
	LAST_GASP: 55, 
	LAST_STAND: 20,
	LIQUIDATOR: 60,
	LONG_RANGE_SECONDARY_BATTERY_SHELLS: 40, 
	MAIN_BATTERY_AND_AA_EXPERT: 9, 
	MAIN_BATTERY_AND_AA_SPECIALIST: 1, 
	MANUAL_SECONDARY_BATTERY_AIMING: 26, 
	OUTNUMBERED: 66,
	PATROL_GROUP_LEADER: 49, 
	PREVENTIVE_MAINTENANCE: 18,
	PRIORITY_TARGET: 28,
	PROXIMITY_FUZE: 59, 
	PYROTECHNICIAN: 46, 
	RADIO_LOCATION: 34,
	REPAIR_SPECIALIST: 52, 
	SEARCH_AND_DESTROY: 51, 
	SECONDARY_ARMAMENT_EXPERT: 36, 
	SIGHT_STABILIZATION: 15, 
	SONARMAN: 70, 
	SONARMAN_EXPERT: 71, 
	SUPER_HEAVY_AP_SHELLS: 37, 
	SUPERINTENDENT: 17,
	SURVIVABILITY_EXPERT: 25,
	SURVIVABILITY_EXPERT_CV: 56, 
	SWIFT_FISH: 24,
	SWIFT_FISH_CV: 58, 
	SWIFT_IN_SILENCE: 65, 
	TOP_GRADE_GUNNER: 63,
	TORPEDO_AIMING_MASTER: 73, 
	TORPEDO_BOMBER: 57, 
	TORPEDO_CREW_TRAINING: 72, 
	VIGILANCE: 7, 
	WATCHFUL: 76, 
};

/**
 * This class describes a captain. Captains are a collection of skills, each of which modifies the ship
 * the captain commands.
 *
 * Some captains are legendary; they have improved standard skills and, in addition, extra unique skills.
 * Only the improved standard skills are modeled here, since the unique skills often require rare preconditions
 * be met - usually gaining an achievement such as Kraken Unleashed or similar. Since this happens - if at 
 * all - late into the game, it would not be a useful briefing contribution.
 *
 * @see Captain.gamedata
 */
export default class Captain extends GameObject {
	
	/* 
	 *	Source: https://github.com/WoWs-Builder-Team/DataConverter/blob/51d5c29cb0224799ca12db4d1da2c4d83d6e5d7f/DataConverter/JsonData/SKILLS_BY_TIER.json 
	 *	Game version 0.11.0
	 */
	/**
	 * Describes what skills can be applied on what ship type.
	 * @todo: Check for correctness
	 */
	static CLASS_SKILLS = {
		Cruiser: [ 3, 24, 13, 21, 19, 20, 8, 4, 6, 43, 28, 27, 47, 30, 23, 38, 17, 25, 63, 66, 34, 33, 12, 35 ],
		Auxiliary: [ 3, 24, 13, 21, 19, 20, 8, 4, 6, 43, 28, 27, 47, 30, 23, 38, 17, 25, 63, 66, 34, 33, 12, 35 ], // Whatever an auxiliary is...
		Destroyer: [ 3, 60, 13, 21, 19, 18, 8, 24, 6, 39, 28, 20, 1, 4, 23, 33, 17, 25, 9, 65, 34, 64, 12, 67 ],
		Battleship: [ 21, 8, 13, 5, 19, 18, 3, 33, 61, 7, 28, 35, 37, 40, 23, 2, 44, 27, 81, 26, 62, 42, 12, 14 ],
		Submarine: [ 68, 60, 79, 28, 19, 75, 72, 74, 18, 20, 69, 70, 80, 76, 17, 82, 73, 71, 77, 78 ],
		AirCarrier: [ 55, 11, 32, 29, 31, 51, 57, 58, 16, 52, 36, 49, 15, 48, 46, 10, 56, 22, 54, 59, 41, 53, 45, 50 ]		
	}

	/**
	 * The skills this captain **can learn**.
	 * @type {Captain.Skill[]}
	 */
	skills;

	/**
	 * The skills that this captain **has learned**.
	 * @type {Captain.Skill[]}
	 */
	learned;

	/**
	 * Get an array of the skills that are trainable on the provided `ship`. The result is dependent
	 * on the ship's type (i.e. cruiser, destroyer, ...).
	 * @param  {Ship} ship The ship for which to get trainable skills
	 * @return {Skill[]}      The skills which can be trained on this ship.
	 * @throws Throws a TypeError if `ship` is not a `Ship` or if `ship.getSpecies()` returns a value
	 * other than `destroyer`, `cruiser`, `battleship`, `aircarrier`, `submarine` or `auxiliary`.
	 */
	getLearnableForShip(ship) {
		Ship.errorIfNotShip(ship);

		let species = ship.getSpecies();
		if (!Object.keys(Captain.CLASS_SKILLS).includes(species))
			throw new TypeError(`Unknown ship species ${species}. Could not get trainable skills`);

		return this.skills.filter(skill => skill.eligible(ship));
	}

	/**
	 * Out of all the skills this captain has learned, returns those that are eligible for the provided
	 * ship.
	 * @param  {Ship} ship The ship for which to check.
	 * @return {Captain.Skill[]}      The learned skills that are eligible for the `ship`.
	 * @throws Throws a `TypeError` if `ship` is not an instance of `Ship`.
	 */
	getLearnedForShip(ship) {
		Ship.errorIfNotShip(ship);
		return this.learned.filter(skill => skill.eligible(ship));
	}

	/**
	 * Lets the captain "learn" the provided skill. This can be thought of as activating the skill
	 * for this captain.
	 *
	 * This is independent of a specific ship. A captain can have a variety of skills, pertaining
	 * to different ship types. What skills to bring to effect is determined when actually 
	 * taking command of a ship.
	 * @param  {Captain.Skill|number|Array<Captain.Skill|number>} skill The skill to learn. Can be a `Captain.Skill` or
	 * a number, in which case the skill with that number will be retrieved and learned. Can also be a (possibly mixed)
	 * array of the above, in which all of the skills in the array will be learned.
	 */
	learn(skill) {
		if (!Array.isArray(skill)) skill = [skill];

		for (let s of skill) {
			if (typeof s === 'number')
				s = this.skills.find(x => x.getSkillnumber() === s);

			if (s && !this.learned.includes(s))
				this.learned.push(s);			
		}
	}

	/**
	 * Returns whether this captain is eligible to command the given ship. A captain is eligible if the ship's reference
	 * name is whitelisted in `CrewPersonality.ships.ships`, or if `groups`, `nations`, and `peculiarity` are either empty or 
	 * contain the respective values for the given `ship`.
	 * @param  {Ship} ship The ship for which to check.
	 * @return {boolean} `True` if this captain can command the ship, `false` otherwise.
	 */
	eligible(ship) {
		Ship.errorIfNotShip(ship);

		// If there is a whitelist, the ship must be in it
		if (this.get('CrewPersonality.ships.ships').length > 0)
			return this.get('CrewPersonality.ships.ships').includes(ship.getName());
		
		// Where a property of CrewPersonality.ships is empty, it won't limit what ships the captain can command,
		// but if it is set, it must contain the ship's value for that property
		return (this.get('CrewPersonality.ships.groups').length === 0 || this.get('CrewPersonality.ships.groups').includes(ship.get('group')))
			&& (this.get('CrewPersonality.ships.nation').length === 0 || this.get('CrewPersonality.ships.nation').includes(ship.getNation()))
			&& (this.get('CrewPersonality.ships.peculiarity').length === 0 || this.get('CrewPersonality.ships.peculiarity').includes(ship.get('peculiarity')))
	}

	/**
	 * Checks whether this captain is the default captain for his nation. There is not an obvious indication of whether this is the
	 * case in the captain's game data, however, it appears that the following always holds true for default captains:
	 *
	 * - `CrewPersonality.peculiarty` is `default`
	 * - `CrewPersonality.personName` is `''`
	 * - `CrewPersonality.tags` is empty
	 * @return {Boolean} `True` if this captain is a default captain, `false` otherwise.
	 */
	isDefault() {
		return this.get('CrewPersonality.peculiarity') === 'default' 
			&& this.get('CrewPersonality.personName') === ''
			&& this.get('CrewPersonality.tags').length === 0;
	}

	constructor(data) {
		// Should not need to clone here since we will not be changing the values
		super(data);

		this.learned = [];
		// Turn the skills from the data into an array of Skill objects.
		// This will also lose the name, but that shouldn't be a problem.
		this.skills = Object.values(this.get('Skills')).map(skill => new Captain.Skill(skill));
	}
}

/**
 * A single skill that a captain has. Each skill modifies the ship the captain commands. Some skills are conditional: 
 * They only take effect when certain circumstances apply. This is not modeled in this class.
 */
Captain.Skill = class {
	constructor(data) {
		this._data = data;
	}

	/**
	 * Indicates whether this skill can be used when commanding the provided ship.
	 * @param  {Ship} ship The ship for which to check.
	 * @return {boolean}      True if this skill is usable with the ship, false otherwise.
	 * @throws Throws a `TypeError` if `ship` is not a `Ship`.
	 */
	eligible(ship) {
		Ship.errorIfNotShip(ship);

		return Captain.CLASS_SKILLS[ship.getSpecies()].includes(this.getSkillnumber());
	}

	/**
	 * Gets `Modifier` objects for the changes this captain skill makes.
	 *
	 * @return {Modifier[]} Modifiers for the modifications this skill makes. 
	 * @see Modifier
	 */
	getModifiers() {
		let modifiers = this._data.modifiers;
		return Object.keys(modifiers)
					.flatMap(key => Modifier.from(key, modifiers[key]))
					.filter(modifier => modifier.target !== undefined && modifier.target !== null);
	}

	getSkillnumber() { return this._data.skillType; }
}