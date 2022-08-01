import DataObject, { collate } from './dataobject.js';
import { GameObject } from './gameobject.js';
import { Modernization } from './modernization.js';
import { Captain } from './captain.js';
import { Camouflage } from './camouflage.js';
import { Signal } from './signal.js';
import { Consumable } from './consumable.js';
import { arrayIntersect, arrayDifference } from '../util/util.js';
import DotNotation from '../util/dotnotation.js';
import createModule from './module.js';
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
 *      Module line       '    Module line   '    Module line
 *      _Artillery        '       _Hull      '     _Engine
 *                        '                  '
 *      AB1_Artillery     '      A_Hull      '     AB1_Engine
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
 * ### Camouflage
 *
 * Camouflages modify a ship's visuals, but also have some impact on the ship's characteristics. Since 0.11.6,
 * camouflages are visual only. Setting them is now deprecated and will be removed at some point in the future.
 *
 * ### Signal flags
 *
 * Much as camouflages, signal flags provide some bonuses to a ship that mounts them. While only one camouflage
 * can be set on a ship, several signal flags can be mounted at the same time.
 *
 * @see Ship.gamedata
 */
class Ship extends GameObject {
	/**
	 * The cached result of getModuleLines, because building module lines is expensive(~50ms).
	 */
	#moduleLines;
	/**
	 * The already equipped upgrades
	 */
	#modernizations;
	/**
	 * The captain that is commanding this ship
	 */	
	#captain;
	/**
	 * The camouflage that is set on this ship
	 */
	#camouflage;
	/**
	 * The signal flags that are hoisted on this ship.
	 */
	#signals;

	/**
	 * Creates a new `Ship` object, initially setting its module configuration to the one provided
	 * in `descriptor`. 
	 * @param  {Object} data       The ship's data.
	 * @param  {String} [descriptor='stock'] The initial module configuration for the new ship. Defaults to `stock`.
	 */
	constructor(data, descriptor = 'stock') {
		super(data);

		let self = this;

		self.#modernizations = [];
		self.#signals = [];
		self.equipModules(descriptor);

		// Set the flavors of all consumables this ship has
		// This is necessary because within the game data, consumable definitions are arrays of length 2
		// consisting of the consumable reference name (already expanded by GameObjectFactory) and the name
		// of the flavor.
		// 
		// To avoid forcing all lazy references to expand at this point, we wrap the lazy-expansion getter 
		// in another getter that sets the flavor right after expansion. When the lazy expansion replaces the
		// property definition, this getter will disappear as well. 
		this.get('ShipAbilities.AbilitySlot*.abils.*', { collate: false }).forEach(ability => {
			// Abilities are arrays of length 2, with the consumable definition in slot 0 and the flavor in slot 1
			const consumableProperty = Object.getOwnPropertyDescriptor(ability, '0');
			if (consumableProperty.get) {
				Object.defineProperty(ability, '0', {
					get: function() {
						// Pass 'this' through to the original accessor
						// (Otherwise it would get called with 'this' set to this property descriptor)
						const consumable = consumableProperty.get.call(this);
						dedicatedlog.debug(`Set flavor ${ability[1]} on consumable ${consumable.getName()} on first read`);
						consumable.setFlavor(ability[1]);
						return consumable;
					},
					enumerable: true,
					configurable: true,
				});
			} else if (consumableProperty.value)
				// If this is for whatever reason already a value property, 
				// call setFlavor if it exists, or do nothing if setFlavor doesn't exist
				consumableProperty.value.setFlavor?.call(consumableProperty.value, ability[1]);
		});
	}

	multiply(key, factor) {
		let path = DotNotation.elements(key);

		// If multiplying into a consumable, hand it off to the consumables object
		if (path[0] === 'consumables') {
			return this.consumables.multiply(DotNotation.join(path.slice(1)), factor);
		// If multiplying into a module, hand it off to that module
		} else if (path[0] in this._configuration) {
			const module = this[path[0]];
			path = path.slice(1);
			return module?.multiply(DotNotation.join(path), factor)
		
		// Otherwise, multiply directly
		} else
			return super.multiply(key, factor);
	}

	get(key, options) {
		let path = DotNotation.elements(key);
		
		// If getting a value from a consumable, hand it off to that consumable
		if (path[0] === 'consumables') {
			return this.consumables.get(DotNotation.join(path.slice(1)), options);

		// If getting a value from a module, hand it off to that module
		} else if (path[0] in this._configuration) {
			const module = this[path[0]];
			path = path.slice(1);
			return module?.get(DotNotation.join(path), options)
		
		// Otherwise, get directly
		} else
			return super.get(key, options);
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
		if (this.#captain) {
			let skills = this.#captain.getLearnedForShip(this);
			for (let skill of skills) {
				let modifiers = skill.getModifiers();
				for (let modifier of modifiers) modifier.invert().applyTo(this);
			}
		}

		// @todo Apply skills even if learned after setting the captain. (-> Observer pattern)

		// Get captain skills, if captain is set. If being set to null, default to empty array
		let skills = captain?.getLearnedForShip(this) ?? []; 
		for (let skill of skills) {
			let modifiers = skill.getModifiers();
			for (let modifier of modifiers) modifier.applyTo(this);
		}
		this.#captain = captain;
	}	

	/**
	 * Sets the camouflage for this ship and applies its effects. If another camouflage was previously
	 * set, its effects will be removed.
	 * @param {Camouflage} camouflage The camouflage to set. If the camouflage is not eligible,
	 * nothing will be done. Passing a value of `null` or `undefined` or any other falsy value will
	 * remove a previously set camouflage.
	 * @returns `True` if the camouflage was mounted, `false` otherwise. 
	 * @throws Throws a `TypeError` if `camouflage` is not an instance of `Camouflage`.
	 */
	setCamouflage(camouflage) {
		if (camouflage && !(camouflage instanceof Camouflage)) throw new TypeError(`Expected a Camouflage but got a ${camouflage}`);

		// Don't equip if not eligible
		if (camouflage && !camouflage.eligible(this)) return false;

		// Remove the effects of the previously set camouflage, if any
		if (this.#camouflage) {
			let modifiers = this.#camouflage.getModifiers();
			for (let modifier of modifiers)
				modifier.invert().applyTo(this);
		}

		if (camouflage)
			for (let modifier of camouflage.getModifiers())
				modifier.applyTo(this);

		this.#camouflage = camouflage;
		return true;
	}

	/**
	 * Hoists the signal on this ship and applies its effects. If the signal was already hoisted, nothing will be done.
	 * @param  {Signal} signal The signal to hoist.
	 */
	hoist(signal) {
		if (signal && !(signal instanceof Signal)) throw new TypeError(`Expected a Signal but got a ${signal}`);

		// Don't hoist if already hoisted
		if (this.#signals.some(s => s.getID() === signal.getID())) {
			rootlog.debug(`Did not hoist signal ${signal.getName()} on ship ${this.getName()} because it was already hoisted`);
			return;
		}

		for (let modifier of signal.getModifiers())
			modifier.applyTo(this);

		this.#signals.push(signal);
		rootlog.debug(`Hoisted signal ${signal.getName()} on ship ${this.getName()}`);
	}

	/**
	 * Lowers a previously hoisted signal and removes its effects. If the signal was not previously hoisted,
	 * nothing will be done.
	 * @param  {Signal} signal The signal to lower.
	 */
	lower(signal) {		
		let index = this.#signals.findIndex(s => s.getID() === signal.getID());
		if (index > -1) {			
			for (let modifier of signal.getModifiers())
				modifier.invert().applyTo(this);

			this.#signals.splice(index, 1);

			rootlog.debug(`Lowered signal ${signal.getName()} on ship ${this.getName()}`);
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
		let self = this;		
		
		if (!(modernization instanceof Modernization))
			throw new TypeError(`Tried to equip ${modernization} but it is not a Modernization`);
		
		// Don't equip if already equipped or not eligible
		if (self.#modernizations.some(equipped => equipped.getName() === modernization.getName()) || !modernization.eligible(self))
			return false;

		let modifiers = modernization.getModifiers();
		for (let modifier of modifiers) {
			modifier.applyTo(self);
		}
		// Remember that it is already equipped now
		self.#modernizations.push(modernization);
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
		let index = this.#modernizations.findIndex(equipped => equipped.getID() === modernization.getID());
		
		// Don't equip if already equipped or not eligible
		if (index === -1)
			return false;

		// Remove the effects of the modernization
		let modifiers = this.#modernizations[index].getModifiers();
		for (let modifier of modifiers)
			modifier.invert().applyTo(this);

		this.#modernizations.splice(index, 1);
		return true;
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
		let self = this;
		let moduleLines = self.getModuleLines();

		// Expand shorthand notations such as descriptor === 'stock' and
		// descriptor === 'top'
		// Replace human-readable notations such as 'artillery' or 'engine' by
		// proper ucTypes (i.e. '_Artillery' and '_Engine')
		// Expand 'others' definition to all remaining types that have not been
		// defined explictly.
		// Throws a TypeError if the descriptor does not contain definitions for
		// all types in moduleLines unless and there is no 'others' definition
		function normalize(descriptor) {
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

			// Turn all type into ucTypes
			descriptor = descriptor.map(subdescriptor => 
					subdescriptor.startsWith('_') ? subdescriptor : '_' + subdescriptor.charAt(0).toUpperCase() + subdescriptor.substring(1)
			);

			// Find an 'others' definition if one exists
			let others = descriptor.find(subdescriptor => subdescriptor.startsWith('_Others'));
			// Get the types that have not been explicitly defined
			// This is all the types in module lines minus the ones in descriptor
			let remainingTypes = arrayDifference(Object.keys(moduleLines), descriptor.map(subdescriptor => subdescriptor.split(':')[0].trim()));
			// If an 'others' definition exists, expand it
			if (others){
				// Remember what level to set everything to
				let level = others.split(':')[1].trim();
				// Take out the 'others' definition, we will replace it now with explicit subdescriptors
				// for all remaining types
				descriptor = descriptor.filter(subdescriptor => !subdescriptor.startsWith('_Others')) 
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
		function retrieve(subdescriptor) {
			let type = subdescriptor.split(':')[0].trim();
			let level = subdescriptor.split(':')[1].trim();

			let line = moduleLines[type];			
			if (level === 'stock') level = 0;
			else if (level === 'top') level = line.length - 1;
			else level = Number(level);

			return line[level];
		}

		descriptor = normalize(descriptor); 
		// Retrieve the modules as defined by the descriptor
		let toApply = descriptor.map(retrieve);
		
		// Start building the configuration
		let configuration = {};		
		for (let module of toApply) {
			// For every component definition in every module
			for (let componentKey in module.components) {
				let component = module.components[componentKey];				
				if (!configuration[componentKey])
					// If this component has not yet been set in the configuration, set it now
					configuration[componentKey] = component;
				else
					// If it has already been set, there must be ambiguity
					// Attempt to resolve by intersecting the existing definition with this
					// module's one
					// (If modules have conflicting definitions, the result will be length 0 after this.)
					configuration[componentKey] = arrayIntersect(configuration[componentKey], component);
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
			configuration[componentKey] = configuration[componentKey][0];
			Object.defineProperty(this, componentKey, {
				value: createModule(componentKey, this, this._data[configuration[componentKey]]),
				writable: false,
				configurable: true,
				enumerable: true
			});
		}
		this._configuration = configuration;

		// Remember the equipped modernizations, re-initialize to no equipped,
		// and re-apply them all
		let modernizations = self.#modernizations;
		self.#modernizations = [];
		modernizations.forEach(modernization => self.equipModernization(modernization));
		// Re-apply the effects of the captain
		if (self.#captain) {
			let captain = self.#captain;
			self.#captain = null;
			self.setCaptain(captain);
		}
		// Re-apply the effects of the camouflage
		if (self.#camouflage) {
			let camouflage = self.#camouflage;
			self.#camouflage = null;
			self.setCamouflage(camouflage);
		}
		// Re-apply the effects of the hoisted signals
		let signals = this.#signals;
		this.#signals = [];
		signals.forEach(signal => this.hoist(signal));
	}

	/**
	 * Get the module lines for this ship. Building the ship's module lines tends to be an 
	 * expensive operation, so this method will return a cached result on subsequent calls. 
	 */
	getModuleLines() {
		/*
			This algorithm works as follows:
			It puts all the module definitions from ShipUpgradeInfo into
			an array. As long as this array is not empty, it removes the
			first item from the START of the array and examines it.

			If this module is the start of a module line (i.e., its prev 
			property equals ''), module is put at the start of the module
			line, and its distance metadata is set to 0.

			Otherwise, it tries to find the predecessor for the module in any
			module line. If none can be found, it must not have been processed yet.
			The module is appended again to the END of the list to be looked at
			again later.

			If a predecessor is found, the module's distance metadata is the predecessor's
			distance + 1. The module is then inserted into its module line such that
			the module to its left has a lower distance value, the module to its right
			a higher distance value. (This can also mean inserting at the start or end).
		 */
		let self = this;		

		// Building module lines is a relatively expensive operation (~50-100ms).
		// Therefore, only build once and then cache.
		// On subsequent calls, read from cache if available and not forced to rebuild.
		if (self.#moduleLines)
			return self.#moduleLines;

		// Helper function that returns true if the argument is an 
		// module definition
		function isModuleDefinition(o) {
			return typeof o === 'object'
				&& o.hasOwnProperty('components')
				&& o.hasOwnProperty('prev')
				&& o.hasOwnProperty('ucType');
		}		

		// Get everything in ShipUpgradeInfo
		let modules = this._data.ShipUpgradeInfo;
		
		// Initialize metadata to be kept for each module.
		// We need this for the algorithm to work: For one thing,
		// we need to preserve the key names of the individual module
		// definitions, because the "prev" property references those. 
		// Of course, we could just keep working with the ShipUpgradeInfo
		// object, but that makes handling and iterating over the module
		// definitions much more convoluted: Lots of Object.keys(), Object.values()
		// and Object.entries() calls. So instead, we will project down to 
		// an array of module definition objects soon, and keep key names
		// as metadata.
		// 
		// Keys for the metadata will be hashes of their corresponding
		// module objects.
		let metadata = new WeakMap();
		for (let moduleKey in modules) {
			let module = modules[moduleKey];
			// Filter out primitives
			if (!isModuleDefinition(module)) continue;
			// Save the module's key name in metadata
			metadata.set(modules[moduleKey], { name: moduleKey });
		}
		// Now project down to module definition objects
		modules = Object.values(modules)
			// Filter out only those that are objects. Now contains
			// arrays of the form [keyname, object]
			.filter(obj => isModuleDefinition(obj));

		let moduleLines = {};

		// As long as there are still unprocessed modules
		while (modules.length > 0) {
			// Take the first one out
			let module = modules.shift();	

			if (module.prev === '') {
				// This module is the beginning of the module line. Put it at the front.
				// If the module line does not exist yet, create one.
				if (!moduleLines[module.ucType]) moduleLines[module.ucType] = [];
				
				// Insert at the front
				moduleLines[module.ucType].splice(0, 0, module);
				// The module is at the start of the module line, so its distance is 0
				metadata.get(module).distance = 0;
			} else {
				// Try to find the module's predecessor. This might be in any module line.
				// The predecessor is that module whose metadata name property equals the prev
				// property of the module we're currently dealing with.
				let predecessor = null;
				for (let line of Object.values(moduleLines)) {
					predecessor = line.find(u => metadata.get(u).name === module.prev);
					if (predecessor) break;
				}

				if (!predecessor) {
					// If no predecessor has been found in any module line, it must not have
					// been processed yet. 
					// Put the module back into the list and continue with the next one.
					modules.push(module);
					continue;
				} else {
					// If one has been found, our module's distance metadata is the predecesor's
					// distance plus one.
					metadata.get(module).distance = metadata.get(predecessor).distance + 1;
					// Initialize the module's module line if necessary
					if (!moduleLines[module.ucType]) moduleLines[module.ucType] = [];
					
					// Two short-hands that make the following code a little more readable
					let line = moduleLines[module.ucType];
					let distance = (u => metadata.get(u).distance);

					// Look for the insertion index. This is the place where the previous module
					// in the line has a lower distance, and the subsequent one has a higher distance.
					let index = -1;
					for (let i = -1; i < line.length; i++) {
						// The distances to the left and right
						let lowerbound; let upperbound;
						switch (i) {
							case -1: 
								lowerbound = Number.NEGATIVE_INFINITY; // If we are just starting out, the lowerbound -oo ...
								upperbound = distance(line[0]); // ... and the upper bound is the distance of the first item
								break;
							case line.length - 1: 
								lowerbound = distance(line[i]); // If we are at the end, the lower bound is the distance of the last item ...
								upperbound = Number.POSITIVE_INFINITY; // ... and the upper bound is +oo
								break;
							default:
								lowerbound = distance(line[i]); // In all other cases, the lower bound is the distance of the current item ...
								upperbound = distance(line[i+1]); // ... and the upper bound is the distance of the next item
						}
						// If we are between the lower and the upper bound, we have found the right place
						if (lowerbound < distance(module) && distance(module) < upperbound) {
							// Insert at the next index
							index = i + 1;
							// If we have already found the right place, no need to continue
							break;
						}
					}
					if (index > -1)
						line.splice(index, 0, module);
				}
			}
		}
		// Cache for later
		self.#moduleLines = moduleLines;
		return moduleLines;
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
		return new Ship.Consumables(this.get('ShipAbilities'));
	}

	getClass() { return this.get('typeinfo.species'); }
	getTier() { return this.get('level'); }
	/**
	 * Get a list of permanent camouflages that are mountable on this ship.
	 * @return {Array} An array of permanent camouflages.
	 */
	getPermoflages() { return this.get('permoflages'); }
	getSpeed() { return this.get('hull.maxSpeed') * (1 - this.get('engine.speedCoef')); }
	getHealth() { return this.get('hull.health'); }
	getConcealment() { return this.get('hull.visibilityFactor'); }

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

/**
 * Helper class that exposes a ship's consumables as a hash from consumable type to the `Consumable` object.
 */
Ship.Consumables = class extends DataObject {
	constructor(data) {
		super(data);
		this
			.get('AbilitySlot*.abils.*.0', { collate: false })
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
			.get('AbilitySlot*')
			.find(abilitySlot => abilitySlot.abils.some(abil => abil[0].consumableType === consumable));
		if (result)
			return result.slot;
		else
			return -1;
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
			.get('AbilitySlot*')
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
		return this.get('AbilitySlot*.abils.*.0');
	}

	/*
		Override to allow getting from/multiplying into consumables in the form consumables.*
		This otherwise isn't possible, because that's not how they are in the underlying
		data structure (AbilitySlot*.abils.*.0).
	 */
	get(key, options) {
		let path = DotNotation.elements(key);
		let targets = DotNotation
			.resolve(path[0], this)
			.filter(target => this[target] instanceof Consumable);
		path = path.slice(1);
		options ??= {};
		options.collate ??= DotNotation.isComplex(key);

		targets = targets.map(target => target.get(DotNotation.join(path)));
		if (options.collate) targets = collate(targets);
		return targets;
	}

	multiply(key, factor) {
		let path = DotNotation.elements(key);
		let targets = DotNotation
			// Resolve first path element to appropriate keys
			.resolve(path[0], this)
			// Filter to those keys that actually reference consumables
			// (Otherwise we also get the _data property, for instance.)
			.filter(target => this[target] instanceof Consumable);
		
		path = path.slice(1);
		return targets.map(target => this[target].multiply(DotNotation.join(path), factor));
	}
}


export { Ship }