import DataObject, { expose } from './dataobject.js';
import GameObject from './gameobject.js';
import Modernization from './modernization.js';
import Captain from './captain.js';
import Signal from './signal.js';
import Consumable from './consumable.js';
import Module from './modules/module.js';
import difference from 'lodash/difference.js';
import intersection from 'lodash/intersection.js';
import rootlog from 'loglevel';
const dedicatedlog = rootlog.getLogger('Ship');

/**
 * This class represents a ship within the game. Ships have some core characteristics (e.g. their tier or nation), but the
 * bulk of their performance characteristics are defined in the form of equippable modules. These characteristics are then
 * subject to modification by {@link Modernization}s, a {@link Captain} and a {@link Camouflage}.
 *
 * 
 *
 * ### Modules
 * 
 * A ship can usually exist in several different configurations through the application of modules. In
 * game, modules can be researched for XP and equipped for credits. Each subsequent module becomes 
 * unlocked only when its predecessor has been researched. Currently, modules of different types (e.g. 
 * hull, torpedoes, etc.) cannot depend on each other: A hull module will only need another hull module
 * to become unlocked, an artillery update only an artillery update, etc. However, this was not the case
 * [prior to update 0.9.6](https://wiki.wargaming.net/en/Ship:Update_0.9.6#Changes_to_the_Port_Modules_tab).
 *
 * There are still legacy ship definitions in the game data (e.g. PJSD007_Fubuki_1944) that follow the old
 * logic, and therefore this class allows for such cases as well. Regardless of their interdependency for
 * research in the game, modules are always grouped by their type in this class. The series of modules for
 * of a certain type is called a *module line*. 
 *
 * This example shows the difference:
 * ```
 *
 * 
 *      Module line       '    Module line   '     Module line
 *      _Artillery        '       _Hull      '      _Engine
 *                        '                  '
 *      AB1_Artillery     '      A_Hull      '      AB1_Engine
 *                        '         |        '        
 *                        '         |        '        
 *                        '         V        '
 *      AB2_Artillery <--------- B_Hull --------->  AB2_Engine
 *                        '                  '
 *                        '                  '
 *
 * 
 *  '  = Module line delineation
 * --> = Research progression
 * ``` 
 * As can be seen, while research progression to both the improved artillery and engine depend on the B_Hull
 * being researched, the module lines are homogenous in type.
 *
 * ### Modernizations
 *
 * Modernizations are known as "upgrades" in the game. They can be equipped in slots and improve the ship's 
 * characteristics. Not all upgrades are eligible for every ship - this largely depends on ship tier. Also, 
 * in game, upgrades compete with each other in the sense that each upgrade slot usually offers a variety of
 * different choices. This is not modeled here, since the purpose of this project is to look at the capabilities
 * a ship _could_ have.
 *
 * ### Captain
 *
 * Putting a captain in command of a ship will allow the captain's learned skill to further modify the ship's
 * characteristics. Note that, as of current, any skills a captain learns after being put in command of a ship
 * will **not** modify the ship's characteristics. 	This is planned as a future feature.
 *
 * ### Signal flags
 *
 * Much as camouflages, signal flags provide some bonuses to a ship that mounts them. While only one camouflage
 * can be set on a ship, several signal flags can be mounted at the same time.
 *
 * @see Ship.gamedata
 */
export default class Ship extends GameObject {
	/**
	 * Equipped captain, signals, modernizations or modules that are modifying this ship.
	 */
	_equipped = [];

	/**
	 * Creates a new `Ship` object, initially setting its module configuration to the one provided
	 * in `descriptor`. 
	 * @param  {Object} data       The ship's data.
	 * @param  {String} [descriptor='stock'] The initial module configuration for the new ship. Defaults to `stock`.
	 */
	constructor(data, descriptor = 'stock') {
		super(data);

		this.equipModules(descriptor);
	}

	/**
	 * Sets the captain that is to command this ship, bringing all his learned eligible skills for this ship 
	 * to bear.
	 * @param {Captain} captain The captain that is to command the ship.
	 * @throws Throws a `TypeError` if `captain` is not an instance of `Captain`.
	 */
	setCaptain(captain) {
		if (captain && !(captain instanceof Captain)) throw new TypeError(`Expected a Captain, but got a ${captain}`);
		
		// Remove old captain's effects if ship was already under command
		this._equipped
			.find(item => item instanceof Captain)
			?.getLearnedForShip(this)
			?.flatMap(skill => skill.getModifiers())
			?.forEach(modifier => modifier.invert().applyTo(this));

		// @todo Apply skills even if learned after setting the captain. (-> Observer pattern)

		// Get captain skills, if captain is set. If being set to null, default to empty array
		(captain?.getLearnedForShip(this) ?? [])
			.flatMap(skill => skill.getModifiers())
			.forEach(modifier => modifier.applyTo(this)); 

		if (captain) 
			this._equipped.push(captain);
	}	

	/**
	 * Hoists the signal on this ship and applies its effects. If the signal was already hoisted, nothing will be done.
	 * @param  {Signal} signal The signal to hoist.
	 */
	hoist(signal) {
		if (signal && !(signal instanceof Signal)) throw new TypeError(`Expected a Signal but got a ${signal}`);

		// Don't hoist if already hoisted
		if (this._equipped.some(s => s.id === signal.id)) {
			rootlog.debug(`Did not hoist signal ${signal.name} on ship ${this.name} because it was already hoisted`);
			return;
		}

		signal.getModifiers().forEach(modifier => modifier.applyTo(this));
		this._equipped.push(signal);

		rootlog.debug(`Hoisted signal ${signal.name} on ship ${this.name}`);
	}

	/**
	 * Lowers a previously hoisted signal and removes its effects. If the signal was not previously hoisted,
	 * nothing will be done.
	 * @param  {Signal} signal The signal to lower.
	 */
	lower(signal) {		
		const index = this._equipped.findIndex(item => item.id === signal.id);

		if (index > -1) {
			signal.getModifiers().forEach(modifier => modifier.invert().applyTo(this));
			this._equipped.splice(index, 1);

			rootlog.debug(`Lowered signal ${signal.name} on ship ${this.name}`);
		}
	}

	/**
	 * Equips a modernization (called upgrade in-game) by applying all its modifiers to the current
	 * configuration. If this ship is not eligible for the modernization, nothing will happen.
	 *
	 * The already equipped upgrades are tracked. If the modernization is already equipped, nothing
	 * will happen.
	 * @param  {Modernization} modernization The modernization to equip
	 * @returns `True` if the modernization was equipped, `false` otherwise. 
	 * @throws 
	 * Throws a `TypeError` if `modernization` is not a `Modernization`.
	 */
	equipModernization(modernization) {
		if (!(modernization instanceof Modernization))
			throw new TypeError(`Tried to equip ${modernization} but it is not a Modernization`);
		
		// Don't equip if already equipped or not eligible
		if (this._equipped.some(equipped => equipped.id === modernization.id) || !modernization.eligible(this))
			return false;

		modernization.getModifiers().forEach(modifier => modifier.applyTo(this));
		// Remember that it is already equipped now
		this._equipped.push(modernization);
		return true;
	}

	/**
	 * Unequips the modernization, if it was previously equipped, and removes all its effects from this ship.
	 * @param  {Modernization} modernization The modernization to unequip.
	 * @return {boolean} `True` if the modernization was previously equipped, `false` otherwise.
	 * Throws a `TypeError` if `modernization` is not a `Modernization`.
	 */
	unequipModernization(modernization) {
		if (!(modernization instanceof Modernization))
			throw new TypeError(`Tried to unequip ${modernization} but it is not a Modernization`);
		
		
		// Need to find the modernization by ID first because the object references might not be the same
		const index = this._equipped.findIndex(equipped => equipped.id === modernization.id);
		
		if (index > -1) {
			modernization.getModifiers().forEach(modifier => modifier.invert().applyTo(this));
			this._equipped.splice(index, 1);
			return true;
		}
		return false;
	}

	/**
	 * Applies the module configuration designated by `descriptor` to the ship.
	 *
	 * Descriptor can either be a _simple_ descriptor (the single word `'stock'` or `'top'`) or a _complex_ descriptor.
	 * A complex descriptor is composed of several subdescriptors, each of which takes the form
	 * `type: level`. (The whitespace is optional). `type` must denote the module's type, which can either be
	 * its `ucType` or a more human-readable form that omits the underscore and allows, but does not require the
	 * capitalization of the first letter. Level must either be a number, in which case it is considered to be the
	 * zero-based index of the module within its module line, or one of the words `'stock'` or `'top'`, in which
	 * case it will be the first or last module within its module line, respectively. The special type `'others'` can
	 * be used to collectively define all remaining types not explicitly defined in the descriptor. If a descriptor is
	 * incomplete, i.e. it does not contain definitions for all module lines, this method will throw a `TypeError`.
	 *
	 * Examples for descriptors:
	 * - `'stock'`: The most basic modules (the start of each module line) are equipped.
	 * - `'top'`: The most advanced modules (the end of each module line) are equipped.
	 * - `'engine: stock, hull: top`': The start of the '_Engine' module line and the end of the '_Hull' module
	 * line will be equipped. (Note: This will throw an error if the ship has module lines beyond those two.)
	 * - `'_Engine: stock, _Hull: top'`: Identical to the previous examples.
	 * - `'engine: stock, hull: top, others: top'`: Identical to the previous example, but will also equip the top
	 * modules for all other module lines.
	 * - `'torpedoes: 1, others: top'`: The second '_Torpedoes' module and the top modules of all other module
	 * line will be equipped. (This is, for instance, a popular configuration for Shimakaze.)
	 *
	 * Any modernizations that were equipped will be re-equipped.
	 * 
	 * @param  {string} descriptor The configuration to apply
	 * @throws
	 * - Throws `TypeError` if the descriptor does not conform to the above rules.
	 */
	equipModules(descriptor) {
		// Expand shorthand notations such as descriptor === 'stock' and
		// descriptor === 'top'
		// Expand 'others' definition to all remaining types that have not been
		// defined explictly.
		// Throws a TypeError if the descriptor does not contain definitions for
		// all types in moduleLines unless and there is no 'others' definition
		const normalize = descriptor => {
			// Expand shorthands
			if (descriptor === 'stock')
				descriptor = 'others: stock';
			else if (descriptor === 'top')
				descriptor = 'others: top';

			// A descriptor should be a series of one or more subdescriptors
			descriptor = descriptor.split(',').map(subdescriptor => subdescriptor.trim());
			// A subdescriptor MUST be of the form type: level
			// A type MAY start with an underscore, but if it is, the next character MUST be a capital
			// A type MAY start with a capital letter
			// A type MUST contain at least one small letter
			// A type MUST be followed by a colon
			// A colon MAY be followed by any number of whitespaces
			// A level MUST be 'stock' or 'top' or a number
			const SUBDESCRIPTOR_REGEX = /^(?:_(?=[A-Z]))?[A-Z]?[a-z]+:[ ]*(?:top|stock|\d+)$/;
			if (!descriptor.every(subdescriptor => SUBDESCRIPTOR_REGEX.test(subdescriptor)))
				throw new TypeError('Malformed descriptor');		

			// Find an 'others' definition if one exists
			let others = descriptor.find(subdescriptor => subdescriptor.startsWith('others'));
			// Get the types that have not been explicitly defined
			// This is all the types in module lines minus the ones in descriptor
			let remainingTypes = difference(Object.keys(this.refits), descriptor.map(subdescriptor => subdescriptor.split(':')[0].trim()));
			// If an 'others' definition exists, expand it
			if (others){
				// Remember what level to set everything to
				let level = others.split(':')[1].trim();
				// Take out the 'others' definition, we will replace it now with explicit subdescriptors
				// for all remaining types
				descriptor = descriptor.filter(subdescriptor => !subdescriptor.startsWith('others')) 
				// Construct subdescriptors for all remaining types
				others = remainingTypes.map(type => type + ': ' + level);
				// Append to the descriptor definition
				descriptor = descriptor.concat(others);
			} else if (remainingTypes.length > 0)
				// If no 'others' definition was found, and there are still remaining types
				// (i.e., types that were not explicitly defined), throw a TypeError
				throw new TypeError('Descriptor did not contain definitions for all modules')

			return descriptor;
		}

		// Helper function to retrieve the module specified by the subdescriptor (type: level) 
		// from moduleLines
		const retrieve = subdescriptor => {
			let type = subdescriptor.split(':')[0].trim();
			let level = subdescriptor.split(':')[1].trim();

			let line = this.refits[type];
			if (level === 'stock') level = 0;
			else if (level === 'top') level = line.length - 1;
			else level = Number(level);

			return line[level];
		}

		descriptor = normalize(descriptor); 
		// Retrieve the modules as defined by the descriptor
		let toApply = descriptor.map(retrieve);
	
		// Revert any equipped modules' modifiers
		for (let modifier of this._equipped.filter(item => item instanceof Module).flatMap(mdl => mdl.getModifiers()))
			modifier.invert().applyTo(this);
		this._equipped = this._equipped.filter(item => !(item instanceof Module));

		// Start building the configuration
		let configuration = {};
		for (let mdl of toApply) {
			// For every component definition in every module
			for (let componentKey in mdl.components) {
				let component = mdl.components[componentKey];				
				if (!configuration[componentKey])
					// If this component has not yet been set in the configuration, set it now
					configuration[componentKey] = component;
				else
					// If it has already been set, there must be ambiguity
					// Attempt to resolve by intersecting the existing definition with this
					// module's one
					// (If modules have conflicting definitions, the result will be length 0 after this.)
					configuration[componentKey] = intersection(configuration[componentKey], component);
			}
		}

		// Now all components in configuration should be arrays of length <= 1
		// Project each down to its only item and create a virtual property for it
		// that reads through to the appropriate module.
		for (let componentKey in configuration) {
			// For ships whose modules DON'T resolve unambiguously such as Midway (i.e., known violators of the 
			// assertModuleComponentsResolveUnambiguously invariant), this will still work provided that the 
			// violating components are at least ordered in such a way that the "correct" module comes first.
			if (configuration[componentKey].length > 1)
				dedicatedlog.warn(`Module descriptor descriptor ${descriptor} did not resolve unambiguously for ${componentKey} of ${this.getName()}. Choosing the first module that fits.`)
			const component = configuration[componentKey][0];

			if (component) {
				// Do not attempt to get modifiers for modules that are not implemented as classes yet
				// (Some modules have only cosmetic value and are not represented in quartersbrief)
				if (component instanceof Module) {
					component.getModifiers().forEach(modifier => modifier.applyTo(this));
					this._equipped.push(component);
				}
				Object.defineProperty(this, componentKey, {
					value: component,
					writable: false,
					configurable: true,
					enumerable: true
				});
			}
		}
	}

	/**
	 * Gets a `Ship.Consumables` hash of all consumables the ship has. Hash keys are the consumable's type, 
	 * the value is the `Consumable`.
	 *
	 * Note that this forces expansion of all lazy references, because there is no other way to 
	 * determine the consumable's `consumableType`.
	 * @return {Object} A hash from consumable type to consumable.
	 */
	get consumables() {		
		return new Ship.Consumables(this._data.ShipAbilities);
	}

	get speed() { return this.hull.maxSpeed * (1 - this.engine.speedCoef); }

	// @todo Implement the following properties again
	// ArtilleryRange: function() { return this.get('artillery.maxDist') * this.get('fireControl.maxDistCoef') },
	// ArtilleryCaliber: function() { return 'artillery.mounts.*.barrelDiameter' },
	// ArtilleryRotationSpeed: 'artillery.mounts.*.rotationSpeed.0',
	// TorpedoRange: function() { return conversions.BWToMeters(this.get('torpedoes.mounts.*.ammoList.*.maxDist')) },
	// TorpedoSpeed: 'torpedoes.mounts.*.ammoList.*.speed',
	// TorpedoDamage: 'torpedoes.mounts.*.ammoList.*.alphaDamage',
	// TorpodoFloodChance: 'torpedoes.mounts.*.ammoList.*.uwCritical',
	// ATBARange: 'atba.maxDist',

	/**
	 * Checks that the provided argument is an instance of `Ship` and throws a `TypeError` otherwise.
	 */
	static errorIfNotShip(ship) { if (!(ship instanceof Ship)) throw new TypeError(`Expected a Ship but got ${ship}`); }
}
expose(Ship, {
	'class': 'typeinfo.species',
	'tier': 'level',
	'permoflages': 'permoflages',
	'group': 'group',
	'peculiarity': 'peculiarity',
	'refits': 'ShipUpgradeInfo'
})
// Make the consumables property enumerable
Object.defineProperty(Ship.prototype, 'consumables', { enumerable: true });

/**
 * Helper class that exposes a ship's consumables as a hash from consumable type to the `Consumable` object.
 */
Ship.Consumables = class extends DataObject {
	constructor(data) {
		super(data);
		this
			.get.call(this._data, 'AbilitySlot*.abils.*', { mode: 'lenient' })
			.forEach(consumable => this[consumable.consumableType] = consumable);
	}

	/**
	 * Returns the slot that the given consumable occupies in this ship's consumables.
	 * @param  {Consumable|String} consumable The consumable to find. Can be either a `Consumable`
	 * object or the consumable's `consumableType`.
	 * @return {Number}            The slot that holds that consumable, or -1 if the ship does not have
	 * that consumable.
	 */
	slotOf(consumable) {
		if (consumable instanceof Consumable)
			consumable = consumable.consumableType;

		let result = this
			.get.call(this._data, 'AbilitySlot*')
			.find(abilitySlot => abilitySlot.abils.some(abil => abil.consumableType === consumable));
		
		return result ? result.slot : -1;
	}

	/**
	 * Returns a `Ship.Consumables` that contains only those consumables that are in the given slot.
	 * @param  {Number} slot The slot for which to get the consumables.
	 * @return {Ship.Consumables}      A new `Ship.Consumables` that is a hash from consumable type
	 * to `Consumable` containing only those consumables that are in the given slot. If the ship does
	 * not have any consumables in that slot, the hash contains no such entries.
	 */
	getSlot(slot) {
		let result = this
			.get.call(this._data, 'AbilitySlot*')
			.find(abilitySlot => abilitySlot.slot === slot);

		if (result)
			result = { [`AbilitySlot${result.slot}`] : result };
		else
			result = { AbilitySlot0: {} };
		
		return new Ship.Consumables(result);
	}

	/**
	 * Returns a `Ship.Consumables` of the consumables that contend for the same slot as `consumable`.
	 * The result includes `consumable`.
	 *
	 * Is equivalent to calling `consumables.getSlot(consumables.slotOf(consumable))`.
	 * @param  {Consumable|String} consumable The consumable for which to get contenders. Can be either
	 * a `Consumable` or a string, in which case it is interpreted as the consumable type.
	 * @return {Ship.Consumables}     A `Ship.Consumables` of all consumables in the same slot as `consumable`.
	 */
	getContending(consumable) {
		return this.getSlot(this.slotOf(consumable));
	}

	/**
	 * Returns all the consumables exposed by this `Ship.Consumables` as an array.
	 * @return {Consumable[]} The consumables in this `Ship.Consumables`.
	 */
	asArray() {
		return this.get.call(this._data, 'AbilitySlot*.abils.*', { mode: 'lenient' });
	}
}