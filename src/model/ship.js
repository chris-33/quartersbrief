var GameObject = require('$/src/model/gameobject');
var hash = require('object-hash').MD5; // Use MD5 because it is faster than the module's default SHA1
var arrayIntersect = require('$/src/util/util').arrayIntersect;
var arrayDifference = require('$/src/util/util').arrayDifference;
var clone = require('$/src/util/util').clone;
var autocreate = require('$/src/util/autocreate-getters');


/**
 * This class represents a ship within the game. Ships are complex objects by themselves, made even more 
 * complicated by the fact that they are the targets of many modifications by modernizations and captain
 * skills.
 *
 * ## Upgrades
 * 
 * A ship can usually exist in several different configurations through the application of upgrades. In
 * game, upgrades can be researched for XP and equipped for credits. Each subsequent upgrade becomes 
 * unlocked only when its predecessor has been researched. Currently, upgrades of different types (e.g. 
 * hull, torpedoes, etc.) cannot depend on each other: A hull upgrade will only need another hull upgrade
 * to become unlocked, an artillery update only an artillery update, etc. However, this was not the case
 * [prior to update 0.9.6](https://wiki.wargaming.net/en/Ship:Update_0.9.6#Changes_to_the_Port_Modules_tab).
 *
 * There are still legacy ship definitions in the game data (e.g. PJSD007_Fubuki_1944) that follow the old
 * logic, and therefore this class allows for such cases as well. Regardless of their interdependency for
 * research in the game, upgrades are always grouped by their type in this class. The series of upgrades for
 * of a certain type is called a *research path*.
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


	#researchPaths;
	#configuration;

	constructor(data) {
		super(data);

		var self = this;
		autocreate(self, Ship.#LOOKUP_DEFINITIONS)
	}

	/**
	 * Applies the configuration designated by `descriptor` to the ship.
	 *
	 * Descriptor can either be a _simple_ descriptor (the single word `'stock'` or `'top'`) or a _complex_ descriptor.
	 * A complex descriptor is composed of several subdescriptors, each of which takes the form
	 * `type: level`. (The whitespace is optional). `type` must denote the upgrade's type, which can either be
	 * its `ucType` or a more human-readable form that omits the underscore and allows, but does not require the
	 * capitalization of the first letter. Level must either be a number, in which case it is considered to be the
	 * zero-based index of the upgrade within its research path, or one of the words `'stock'` or `'top'`, in which
	 * case it will be the first or last upgrade within its research path, respectively. The special type `'others'` can
	 * be used to collectively define all remaining types not explicitly defined in the descriptor. If a descriptor is
	 * incomplete, i.e. it does not contain definitions for all research paths, this method will throw a `TypeError`.
	 *
	 * Examples for descriptors:
	 * - `'stock'`: The most basic upgrades (the start of each research path) are equipped.
	 * - `'top'`: The most advanced upgrades (the end of each research path) are equipped.
	 * - `'engine: stock, hull: top`': The start of the '_Engine' research path and the end of the '_Hull' research
	 * path will be equipped. (Note: This will throw an error if the ship has research paths beyond those two.)
	 * - `'_Engine: stock, _Hull: top'`: Identical to the previous examples.
	 * - `'engine: stock, hull: top, others: top'`: Identical to the previous example, but will also equip the top
	 * upgrades for all other research paths.
	 * - `'torpedoes: 1, others: top'`: The second '_Torpedoes' upgrade and the top upgrades of all other research
	 * path will be equipped. (This is, for instance, a popular configuration for Shimakaze.)
	 * @param  {string} descriptor The configuration to apply
	 * @throws
	 * - Throws `TypeError` if the descriptor does not conform to the above rules.
	 */
	applyConfiguration(descriptor) {
		let self = this;
		let researchPaths = self.getResearchPaths();

		// Expand shorthand notations such as descriptor === 'stock' and
		// descriptor === 'top'
		// Replace human-readable notations such as 'artillery' or 'engine' by
		// proper ucTypes (i.e. '_Artillery' and '_Engine')
		// Expand 'others' definition to all remaining types that have not been
		// defined explictly.
		// Throws a TypeError if the descriptor does not contain definitions for
		// all types in researchPaths unless and there is no 'others' definition
		function normalize(descriptor) {
			// Expand shorthands
			if (descriptor === 'stock')
				descriptor = 'others: stock';
			else if (descriptor === 'top')
				descriptor = 'others: top';

			// A descriptor should be a series of one or more subdescriptors
			// A subdescriptor MUST be look like type: level
			// A type MAY start with an underscore, but if it is, the next character MUST be a capital
			// A type MAY start with a capital letter
			// A type MUST contain at least one small letter
			// A type MUST be followed by a colon
			// A colon MAY be followed by a whitespace
			// A level MUST be 'stock' or 'top' or a digit
			// A subdescriptor MUST either be followed by the end of the string, or by
			// either a comma, a whitespace, or a comma and a whitespace
			// 
			// Perform a global search (do not stop after fist match)
			// Perform a sticky search (begin matching at beginning of string, and matches must be directly 
			// adjacent to each other)
			const DESCRIPTOR_REGEX = /((?:_(?=[A-Z]))?[A-Z]?[a-z]+\:[ ]?(?:top|stock|\d))(?:, |,| |$)/gy
			descriptor = Array.from(descriptor.matchAll(DESCRIPTOR_REGEX));
			// No matches means the descriptor didn't conform to the regex at all
			if (descriptor.length === 0) throw new TypeError('Malformed descriptor');
			// matchAll will return an array for each match, consisting of the matched text
			// (including the separating commas/whitespaces) and any capturing groups
			// (we have only one). 
			// We need to project this to the captured group
			descriptor = descriptor.map(match => match[1]);

			// Turn all type into ucTypes
			descriptor = descriptor.map(subdescriptor => 
					subdescriptor.startsWith('_') ? subdescriptor : '_' + subdescriptor.charAt(0).toUpperCase() + subdescriptor.substring(1)
			);

			// Find an 'others' definition if one exists
			let others = descriptor.find(subdescriptor => subdescriptor.startsWith('_Others'));
			// Get the types that have not been explicitly defined
			// This is all the types in research paths minus the ones in descriptor
			let remainingTypes = arrayDifference(Object.keys(researchPaths), descriptor.map(subdescriptor => subdescriptor.split(':')[0].trim()));
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
				throw new TypeError('Descriptor did not contain definitions for all upgrades')

			return descriptor;
		}

		// Helper function to retrieve the upgrade specified by the subdescriptor (type: level) 
		// from researchPaths
		function retrieve(subdescriptor) {
			let type = subdescriptor.split(':')[0].trim();
			let level = subdescriptor.split(':')[1].trim();

			let path = researchPaths[type];			
			if (level === 'stock') level = 0;
			else if (level === 'top') level = path.length - 1;
			else level = Number(level);

			return path[level];
		}

		descriptor = normalize(descriptor); 
		// Retrieve the upgrades as defined by the descriptor
		let toApply = descriptor.map(retrieve);
		
		// Start building the configuration
		let configuration = {};		
		for (let upgrade of toApply) {
			// For every component definition in every upgrade
			for (let componentKey in upgrade.components) {
				let component = upgrade.components[componentKey];				
				if (!configuration[componentKey])
					// If this component has not yet been set in the configuration, set it now
					configuration[componentKey] = component;
				else
					// If it has already been set, there must be ambiguity
					// Attempt to resolve by intersecting the existing definition with this
					// upgrade's one
					// (If upgrades have conflicting definitions, the result will be length 0 after this.)
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
	 * Get the research paths for this ship. Building the ship's research paths tends to be an 
	 * expensive operation, so this method will return a cached result on subsequent calls. You
	 * can override this by passing `forceRebuild = true`.
	 * @param {boolean} forceRebuild Whether to build the research paths from scratch, regardless
	 * of whether a cached version exists or not. Default is `false`.
	 */
	getResearchPaths(forceRebuild = false) {
		/*
			This algorithm works as follows:
			It puts all the upgrade definitions from ShipUpgradeInfo into
			an array. As long as this array is not empty, it removes the
			first item from the START of the array and examines it.

			If this upgrade is the start of a research path (i.e., its prev 
			property equals ''), upgrade is put at the start of the research
			path, and its distance metadata is set to 0.

			Otherwise, it tries to find the predecessor for the upgrade in any
			research path. If none can be found, it must not have been processed yet.
			The upgrade is appended again to the END of the list to be looked at
			again later.

			If a predecessor is found, the upgrade's distance metadata is the predecessor's
			distance + 1. The upgrade is then inserted into its research path such that
			the upgrade to its left has a lower distance value, the upgrade to its right
			a higher distance value. (This can also mean inserting at the start or end).
		 */
		const KEY_SHIP_UPGRADE_INFO = 'ShipUpgradeInfo';
		var self = this;		

		// Building research paths is a relatively expensive operation (~50-100ms).
		// Therefore, only build once and then cache.
		// On subsequent calls, read from cache if available and not forced to rebuild.
		if (self.#researchPaths && !forceRebuild)
			return self.#researchPaths;

		// Helper function that returns true if the argument is an 
		// upgrade definition
		function isUpgradeDefinition(o) {
			return typeof o === 'object'
				&& o.hasOwnProperty('components')
				&& o.hasOwnProperty('prev')
				&& o.hasOwnProperty('ucType');
		}		

		// Get everything in ShipUpgradeInfo
		var upgrades = self.get(KEY_SHIP_UPGRADE_INFO);
		
		// Initialize metadata to be kept for each upgrade.
		// We need this for the algorithm to work: For one thing,
		// we need to preserve the key names of the individual upgrade
		// definitions, because the "prev" property references those. 
		// Of course, we could just keep working with the ShipUpgradeInfo
		// object, but that makes handling and iterating over the upgrade
		// definitions much more convoluted: Lots of Object.keys(), Object.values()
		// and Object.entries() calls. So instead, we will project down to 
		// an array of upgrade definition objects soon, and keep key names
		// as metadata.
		// 
		// Keys for the metadata will be hashes of their corresponding
		// upgrade objects.
		var metadata = {};
		for (let upgradeKey in upgrades) {
			let upgrade = upgrades[upgradeKey];
			// Filter out primitives
			if (!isUpgradeDefinition(upgrade)) continue;
			// Save the upgrade's key name in metadata
			metadata[hash(upgrades[upgradeKey])] = { name: upgradeKey };
		}
		// Now project down to upgrade definition objects
		upgrades = Object.values(upgrades)
			// Filter out only those that are objects. Now contains
			// arrays of the form [keyname, object]
			.filter(obj => isUpgradeDefinition(obj));

		var researchPaths = {};

		// As long as there are still unprocessed upgrades
		while (upgrades.length > 0) {
			// Take the first one out
			let upgrade = upgrades.shift();	

			if (upgrade.prev === '') {
				// This upgrade is the beginning of the research path. Put it at the front.
				// If the research path does not exist yet, create one.
				if (!researchPaths[upgrade.ucType]) researchPaths[upgrade.ucType] = [];
				
				// Insert at the front
				researchPaths[upgrade.ucType].splice(0, 0, upgrade);
				// The upgrade is at the start of the research path, so its distance is 0
				metadata[hash(upgrade)].distance = 0;
			} else {
				// Try to find the upgrade's predecessor. This might be in any research path.
				// The predecessor is that upgrade whose metadata name property equals the prev
				// property of the upgrade we're currently dealing with.
				let predecessor = null;
				for (let path of Object.values(researchPaths)) {
					predecessor = path.find(u => metadata[hash(u)].name === upgrade.prev);
					if (predecessor) break;
				}

				if (!predecessor) {
					// If no predecessor has been found in any research path, it must not have
					// been processed yet. 
					// Put the upgrade back into the list and continue with the next one.
					upgrades.push(upgrade);
					continue;
				} else {
					// If one has been found, our upgrade's distance metadata is the predecesor's
					// distance plus one.
					metadata[hash(upgrade)].distance = metadata[hash(predecessor)].distance + 1;
					// Initialize the upgrade's research path if necessary
					if (!researchPaths[upgrade.ucType]) researchPaths[upgrade.ucType] = [];
					
					// Two short-hands that make the following code a little more readable
					let path = researchPaths[upgrade.ucType];
					let distance = (u => metadata[hash(u)].distance);

					// Look for the insertion index. This is the place where the previous upgrade
					// in the path has a lower distance, and the subsequent one has a higher distance.
					let index = -1;
					for (let i = -1; i < path.length; i++) {
						// The distances to the left and right
						let lowerbound; let upperbound;
						switch (i) {
							case -1: 
								lowerbound = Number.NEGATIVE_INFINITY; // If we are just starting out, the lowerbound -oo ...
								upperbound = distance(path[0]); // ... and the upper bound is the distance of the first item
								break;
							case path.length - 1: 
								lowerbound = distance(path[i]); // If we are at the end, the lower bound is the distance of the last item ...
								upperbound = Number.POSITIVE_INFINITY; // ... and the upper bound is +oo
								break;
							default:
								lowerbound = distance(path[i]); // In all other cases, the lower bound is the distance of the current item ...
								upperbound = distance(path[i+1]); // ... and the upper bound is the distance of the next item
						}
						// If we are between the lower and the upper bound, we have found the right place
						if (lowerbound < distance(upgrade) && distance(upgrade) < upperbound) {
							// Insert at the next index
							index = i + 1;
							// If we have already found the right place, no need to continue
							break;
						}
					}
					if (index > -1)
						path.splice(index, 0, upgrade);
				}
			}
		}
		// Cache for later
		self.#researchPaths = researchPaths;
		return researchPaths;
	}

}

/**
 * This class represents a configuration of a ship.
 * @name Ship#Configuration
 */
Ship.Configuration = class {
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
		var self = this;
		
		if (!ship || !(ship instanceof Ship)) 
			throw new TypeError(`Expected a ship but got ${ship}`);
		self.#ship = ship;

		Object.assign(self, clone(configuration));			
		autocreate(self, Ship.Configuration.#LOOKUP_DEFINITIONS);

		self.get = self.#ship.get; // "Borrow" the ships getter, but "this" will be bound to the configuration
	}
}

module.exports = Ship;