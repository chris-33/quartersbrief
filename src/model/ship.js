var GameObject = require('$/src/model/gameobject');
var hash = require('object-hash');

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
		self.researchPaths = self.getResearchPaths();
	}

	getConfiguration(name) {
		var self = this;

		var result = {};
		switch (name) {
			case 'stock': 
				for (key in self.researchPaths)
					result[key] = self.researchPaths[key][0];
				break;
			case 'top':
				for (key in self.researchPaths)
					result[key] = self.researchPaths[key][self.researchPaths[key].length - 1];
				break;
		}
		return result;
	}

	/*
		This algorithm works as follows:
		It puts all the upgrade definitions from ShipUpgradeInfo into
		an array. As long as this array is not empty, it removes the
		first item from the START of the array and examines it.
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
		// As long as there are still items in upgrades
		while (upgrades.length > 0) {
			// Take the first one out
			let upgrade = upgrades.shift();	
			if (!researchPaths[upgrade.ucType]) {
				// This upgrade belongs to a research path that has not been 
				// encountered before. Start a new research path for it.
				researchPaths[upgrade.ucType] = [upgrade];
			} else {
				let index;
				// This upgrade is the beginning of the research path, make the insertion
				// index 0.
				if (upgrade.prev === '') 
					index = 0;
				else {
					// Take the appropriate research path from researchPaths (which we know,
					// because we chose ucType as the key for it) and find the index of that 
					// element in it that has prev as the value of the name property in the
					// element's metadata - this used to be the object key in the original file 
					// before we threw that information away. 
					index = researchPaths[upgrade.ucType]
						.findIndex(u => metadata[hash(u)].name === upgrade.prev);

					// The insertion point is the index after that, but leave it untouched if
					// no such item was found.
					if (index > -1) index++;
				}
				
				if (index > -1)
					// Such an index was found, insert the new upgrade at the
					// next position.
					researchPaths[upgrade.ucType].splice(index, 0, upgrade);
				else
					// Such an index was not found - the upgrade's predecessor
					// has not been processed yet.
					// Add it to the rear of the array to deal with later.
					upgrades.push(upgrade);
			}
		}
		return researchPaths;
	}

	getTier() { return this.get(KEYS.TIER); }
	getNation() { return this.get(KEYS.NATION); }
	getType() { return this.get(KEYS.TYPE); }
}

module.exports = Ship;