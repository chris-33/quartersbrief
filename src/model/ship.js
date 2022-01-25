var GameObject = require('$/src/model/gameobject');

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
		upgrades = Object.entries(upgrades)
			// Filter out only those that are objects. Now contains
			// arrays of the form [keyname, object]
			.filter(o => isUpgradeDefinition(o[1]))
			// Keep only the objects, but save the keyname on the object
			// first under the new name 'quartersbrief_name' to keep it 
			// accessible.
			// 
			// This makes handling the data easier from now on, because
			// we only have to deal with objects, not arrays denoting
			// key-value pairs.
			.map(function(o) { 
				let key = o[0]; let val = o[1];
				val['quartersbrief_name'] = key; 
				return val;
			});

		var researchPaths = {};
		// As long as there are still items in upgrades
		while (upgrades.length > 0) {
			// Take the first one out
			let upgrade = upgrades.shift();
				debugger;
				// This upgrade belongs to a research path that has not been 
			// encountered before. Start a new research path for it.
			if (!researchPaths[upgrade.ucType]) {
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
					// element in it that has prev as the value for 'quartersbrief_name' - 
					// this used to be the object key in the original file before we threw that
					// information away. 
					index = researchPaths[upgrade.ucType]
						.findIndex(u => u['quartersbrief_name'] === upgrade.prev);

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