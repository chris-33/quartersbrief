import { GameObject } from './gameobject.js';
import objecthash from 'object-hash'; let hash = objecthash.MD5;
import { arrayIntersect, arrayDifference } from '../util/util.js';
import clone from 'just-clone';
import { autocreate } from '../util/autocreate-getters.js';
import { AccessorMixin } from '../util/accessors.js';

/**
 * This class represents a ship within the game. Ships are complex objects by themselves, made even more 
 * complicated by the fact that they are the targets of many modifications by modernizations and captain
 * skills.
 *
 * ## Modules
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
 */
class Ship extends GameObject {
	/**
	 * Definitions for autocreated getters
	 */
	static #LOOKUP_DEFINITIONS = {
		Nation: 'typeinfo.nation',
		Species: 'typeinfo.species',
		Tier: 'level',
	}


	#moduleLines;
	#configuration;

	constructor(data) {
		super(data);

		let self = this;
		autocreate(self, Ship.#LOOKUP_DEFINITIONS)
	}

	/**
	 * Applies the configuration designated by `descriptor` to the ship.
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
	 * @param  {string} descriptor The configuration to apply
	 * @throws
	 * - Throws `TypeError` if the descriptor does not conform to the above rules.
	 */
	applyConfiguration(descriptor) {
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
		// Project each down to its only item and expand the reference
		// (Any components that had length 0 will be 'undefined' after this.)
		for (let componentKey in configuration) {
			let reference = configuration[componentKey][0];
			configuration[componentKey] = reference ? self.get(reference) : null;
		}

		// Make a deep copy, because otherwise if any values are modified in the configuration further on
		// (e.g. by applying modernizations), it will change the original values, too.
		// This would lead to unexpected behavior when switching configurations back and forth.
		self.#configuration = new Ship.Configuration(self, configuration);
	}

	/**
	 * Gets the ship's current configuration.
	 * @return {Object} The ship's current configuration, or `null` if no configuration has been
	 * set yet.
	 */
	getCurrentConfiguration() {
		return this.#configuration || null;
	}

	/**
	 * Get the module lines for this ship. Building the ship's module lines tends to be an 
	 * expensive operation, so this method will return a cached result on subsequent calls. You
	 * can override this by passing `forceRebuild = true`.
	 * @param {boolean} forceRebuild Whether to build the module lines from scratch, regardless
	 * of whether a cached version exists or not. Default is `false`.
	 */
	getModuleLines(forceRebuild = false) {
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
		const KEY_SHIP_UPGRADE_INFO = 'ShipUpgradeInfo';
		let self = this;		

		// Building module lines is a relatively expensive operation (~50-100ms).
		// Therefore, only build once and then cache.
		// On subsequent calls, read from cache if available and not forced to rebuild.
		if (self.#moduleLines && !forceRebuild)
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
		let modules = self.get(KEY_SHIP_UPGRADE_INFO);
		
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
		let metadata = {};
		for (let moduleKey in modules) {
			let module = modules[moduleKey];
			// Filter out primitives
			if (!isModuleDefinition(module)) continue;
			// Save the module's key name in metadata
			metadata[hash(modules[moduleKey])] = { name: moduleKey };
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
				metadata[hash(module)].distance = 0;
			} else {
				// Try to find the module's predecessor. This might be in any module line.
				// The predecessor is that module whose metadata name property equals the prev
				// property of the module we're currently dealing with.
				let predecessor = null;
				for (let line of Object.values(moduleLines)) {
					predecessor = line.find(u => metadata[hash(u)].name === module.prev);
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
					metadata[hash(module)].distance = metadata[hash(predecessor)].distance + 1;
					// Initialize the module's module line if necessary
					if (!moduleLines[module.ucType]) moduleLines[module.ucType] = [];
					
					// Two short-hands that make the following code a little more readable
					let line = moduleLines[module.ucType];
					let distance = (u => metadata[hash(u)].distance);

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

}

/**
 * This class represents a configuration of a ship.
 * @name Ship#Configuration
 */
Ship.Configuration = class extends AccessorMixin(null) {
	static #LOOKUP_DEFINITIONS = {
		Ruddershift: 'hull.rudderTime',
		Health: 'hull.health',
		TurningCircle: 'hull.turningRadius',
	}

	#ship;

	/** 
	 * Instantiate a configuration for the given `ship`,
	 * using the values in `configuration` as the data.
	 * `configuration` will be deep-copied to the new 
	 * instance.
	 * @param {Ship} ship The ship for which this configuration is.
	 * @param {Object} configuration The configuration values.
	 * @throws 
	 * Throws a `TypeError` if `ship` is not provided or not a ship.
	 */
	constructor(ship, configuration) {
		super();
		let self = this;
		
		if (!ship || !(ship instanceof Ship)) 
			throw new TypeError(`Expected a ship but got ${ship}`);
		self.#ship = ship;

		Object.assign(self, clone(configuration));			
		autocreate(self, Ship.Configuration.#LOOKUP_DEFINITIONS);
	}
}

export { Ship }