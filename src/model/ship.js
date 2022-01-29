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
		property equals ''), a research path for it is created, the upgrade
		is put into it, and its distance metadata is set to 0.

		Otherwise, it checks if a research path for this upgrade exists yet.
		If not, the upgrade gets appended again to the END of the upgrades
		array to be looked at again later.

		If a research path does already exist,

		
		If a research path with this item's ucType does not exist yet,
		it creates one and puts this item into it. If it does exist,
		and the item's prev property is an empty string, that means the
		item is the starting point of that path, and it gets inserted
		at the front of the research path. 
		Otherwise (that is, if a research path does exist and prev is not
		an empty string), it looks for an entry within the research path
		that corresponds to the current item's prev property. If such an 
		item is found, the current item is inserted behind it. 
		If such an item is not found, that must mean it has to not have
		been encountered yet in the upgrades array. The current item is
		then appended again to the END of the upgrades array, to be 
		looked at again later.
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
		let metadata = {};
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
				// This upgrade is the beginning of the research path, start a new research
				// path for it.
				researchPaths[upgrade.ucType] = [upgrade];
				// The upgrade is at the start of the research path, so its distance is 0
				metadata[hash(upgrade)].distance = 0;
			} else if (!researchPaths[upgrade.ucType]) {
				// This upgrade belongs to a research path that has not been 
				// encountered yet, but it is not the beginning of the research path. 
				// Therefore we can't compute its distance metadata yet. Put it back
				// to be examined later
				upgrades.push(upgrade);				
			} else {
				// This upgrade belongs to a known research path.
				
				// Take the appropriate research path from researchPaths (which we know,
				// because we chose ucType as the key for it) and find the index of that 
				// element in it that has prev as the value of the name property in the
				// element's metadata - this used to be the object key in the original file 
				// before we threw that information away. 
				let predecessor;
				for (let path of Object.values(researchPaths)) {
					// Find the upgrade's predecessor. This might be in any research path.
					predecessor = path.find(u => metadata[hash(u)].name === upgrade.prev);
					if (predecessor) {
						metadata[hash(upgrade)].distance = metadata[hash(predecessor)].distance + 1;
						break;
					}
				}
				if (!predecessor) {
					upgrades.push(upgrade);
					continue;
				}
				let path = researchPaths[upgrade.ucType];
				for (let i = 0; i < path.length; i++) {
					let distance = (u => metadata[hash(u)].distance);
					if (distance(path[i]) < distance(upgrade) && 
								(i === path.length - 1 ||
								distance(path[i+1]) > distance(upgrade))) {
						path.splice(i + 1, 0, upgrade);
					}
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