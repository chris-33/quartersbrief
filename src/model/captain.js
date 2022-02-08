import { ComplexDataObject } from '../util/cdo.js';
import { GameObject } from './gameobject.js';
import { Ship } from './ship.js';
import { Modifier } from '../util/modifier.js';



/**
 * This class describes a captain. Captains are a collection of skills, each of which modifies the ship
 * the captain commands.
 *
 * Some captains are legendary; they have improved standard skills and, in addition, extra unique skills.
 * Only the improved standard skills are modeled here, since the unique skills often require rare preconditions
 * be met - usually gaining an achievement such as Kraken Unleashed or similar. Since this happens - if at 
 * all - late into the game, it would not be a useful briefing contribution.
 */
class Captain extends GameObject {
	
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
		AirCarrier: [ 55, 11, 32, 29, 31, 57, 58, 16, 52, 36, 15, 48, 46, 10, 56, 54, 59, 41, 53, 45 ]		
	}

	/**
	 * The skills this captain **can learn**.
	 * @type {Captain.Skill[]}
	 */
	qb_skills;

	/**
	 * The skills that this captain **has learned**.
	 * @type {Captain.Skill[]}
	 */
	qb_learned;

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

		return this.qb_skills.filter(skill => skill.eligible(ship));
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
		return this.qb_learned.filter(skill => skill.eligible(ship));
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

		for (let s of skill) {debugger
			if (typeof s === 'number')
				s = this.qb_skills.find(x => x.getSkillnumber() === s);

			if (s && !this.qb_learned.includes(s))
				this.qb_learned.push(s);			
		}
	}

	constructor(data) {
		// Should not need to clone here since we will not be changing the values
		super(data);

		this.qb_learned = [];

		// Turn the skills from the data into an array of Skill objects.
		// This will also lose the name, but that shouldn't be a problem.
		this.qb_skills = Object.values(this.get('Skills')).map(skill => new Captain.Skill(skill));
	}
}

/**
 * A single skill that a captain has. Each skill modifies the ship the captain commands. Some skills are conditional: 
 * They only take effect when certain circumstances apply. This is not modeled in this class.
 */
Captain.Skill = class extends ComplexDataObject {
	constructor(data) {
		super(data);
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
		let modifiers = this.get('modifiers');
		return Object.keys(modifiers)
					.map(key => Modifier.from(key, modifiers[key]))
					.filter(modifier => modifier.target !== undefined && modifier.target !== null);
	}

	getSkillnumber() { return this.get('skillType'); }
}

export { Captain };