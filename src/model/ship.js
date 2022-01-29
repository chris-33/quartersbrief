var GameObject = require('$/src/model/gameobject');
var hash = require('object-hash').MD5; // Use MD5 because it is faster than the module's default SHA1

const KEYS = {
	SHIP_UPGRADE_INFO: 'ShipUpgradeInfo',
	NATION: 'typeinfo.nation',
	TYPE: 'typeinfo.species',
	TIER: 'level',
};

class Ship extends GameObject {

	researchPaths;

	constructor(data) {
		super(data);

		var self = this;
	}

	getConfiguration(name) {
		var self = this;
		var researchPaths = self.researchPaths || self.getResearchPaths();

		var result = {};
		switch (name) {
			case 'stock': 
				for (key in researchPaths)
					result[key] = researchPaths[key][0];
				break;
			case 'top':
				for (key in researchPaths)
					result[key] = researchPaths[key][researchPaths[key].length - 1];
				break;
		}
		return result;
	}

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
	getResearchPaths() {
		var self = this;		

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
		return researchPaths;
	}

	getTier() { return this.get(KEYS.TIER); }
	getNation() { return this.get(KEYS.NATION); }
	getType() { return this.get(KEYS.TYPE); }
}

module.exports = Ship;