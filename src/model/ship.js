var GameObject = require('$/src/model/gameobject');
var hash = require('object-hash').MD5; // Use MD5 because it is faster than the module's default SHA1
var arrayIntersect = require('$/src/util/util').arrayIntersect;
var clone = require('$/src/util/util').clone;

const KEYS = {
	SHIP_UPGRADE_INFO: 'ShipUpgradeInfo',
	NATION: 'typeinfo.nation',
	TYPE: 'typeinfo.species',
	TIER: 'level',
};

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
 */
class Ship extends GameObject {

	#researchPaths;
	#configuration;

	constructor(data) {
		super(data);

		var self = this;
	}

	/**
	 * Applies the configuration designated by `descriptor` to the ship.
	 *
	 * Descriptor can be one of the following:
	 * - `'stock'`: The most basic upgrades (the start of each research path) are equipped
	 * - `'top'`: The most advanced upgrades (the end of each research path) are equipped
	 * @param  {string} descriptor The configuration to apply
	 * @throws
	 * - Throws if the descriptor is not one of the above.
	 */
	applyConfiguration(descriptor) {
		let self = this;

		let researchPaths = self.getResearchPaths();

		let toApply = {};
		let configuration = {};
		switch (descriptor) {
			case 'stock': 
				toApply = Object.values(researchPaths).map(arr => arr[0]);
				break;
			case 'top': 
				toApply = Object.values(researchPaths).map(arr => arr[arr.length - 1]);
				break;
			default:
				throw new Error(`Unknown configuration descriptor ${name}`);
		}

		for (let upgrade of toApply) {
			for (let componentKey in upgrade.components) {
				let component = upgrade.components[componentKey];
				if (!configuration[componentKey])
					configuration[componentKey] = component;
				else
					configuration[componentKey] = arrayIntersect(configuration[componentKey], component);
			}
		}
		// Now all components in configuration should be arrays of length <= 1
		// Project each down to its only item and expand the reference
		for (let componentKey in configuration) {
			let temp = configuration[componentKey][0];
			configuration[componentKey] = temp ? self.get(temp) : null;
		}

		// Make a deep copy, because otherwise if any values are modified in the configuration further on
		// (e.g. by applying modernizations), it will change the original values, too.
		// This would lead to unexpected behavior when switching configurations back and forth.
		self.#configuration = clone(configuration);
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
		var upgrades = self.get(KEYS.SHIP_UPGRADE_INFO);
		
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

	getTier() { return this.get(KEYS.TIER); }
	getNation() { return this.get(KEYS.NATION); }
	getType() { return this.get(KEYS.TYPE); }
}

module.exports = Ship;