var GameObject = require('$/src/model/gameobject');

const KEYS = {
	SHIP_UPGRADE_INFO: 'ShipUpgradeInfo'
};

/**
 * Contains the magic words that indicate a nested
 * object in the raw data is a hull, engine, etc.
 *
 * Unfortunately, these are not guaranteed to be 
 * exact suffixes, because in some ships' raw data,
 * there are extra parts suffixed. E.g. on U.S. 
 * tier II destroyer Sampson, hulls are called 
 * 'A_Hull_1917' and 'B_Hull_1931'
 * @type {Object}
 */
const KEY_CLUES = {
	HULL: '_Hull',
	ARTILLERY: '_Artillery',
	TORPEDOES: '_Torpedoes',
	FIRECONTROL: '_FireControl',
	ENGINE: '_Engine'
};

/**
 * This class represents a ship in the game. Ships have some intrinsic
 * properties (e.g. research cost, price). Beyond that, they are made 
 * up of several Components: 
 * - hull
 * - artillery (main battery) 
 * - atbas (secondary battery)
 * - torpedoes
 * - air defense (AA guns)
 * - air support (bombing strikes, including ASW depthcharge strikes)
 * - air armament (catapult-launched fighters and spotter planes)
 * - fire control
 * - engine
 * (They also have radars, directors, and finders, but as these are purely
 * cosmetic in nature, they will be ignored from here on. Even the search
 * radars, where present, bear no info on range or duration - this data is
 * present only on the associated consumable.)
 * 
 * Since this program is all about answering the question "What can the
 * enemy do to me", this is a _worst case configuration_ of the ship's
 * properties and abilites that you will never actually encounter in the
 * game. It is constructed by
 * 1. Loading the ship's data.
 * 2. Resolving and loading any references, e.g. to shells, torpedoes, etc. 
 * and replacing these references with the loaded data. After this step,
 * the ship's data contains a complete picture of its properties and 
 * abilities in various configurations.
 * 3. Construct virtual components in which every value takes on the most
 * advantageous value from any of the available configurations. For most
 * ships, this will simply be the top configuration, that is, the one where
 * all upgrades have been researched. There are exceptions, however. Some 
 * Japanese destroyers, for example, have the choice between different
 * torpedoes that are equally valid - the top configuration here is not
 * "better" per se than the others. Shimakaze is an example of this: Here,
 * the top configuration is the 8km-76kts-Type F3 torpedo, which travels
 * faster and reloads more quickly than the more conservative 12km Type 93 mod 3
 * option, which tends to actually be the preferred choice for the Shimakaze.
 * In addition, there are the 20km tubes of the stock configuration.
 * After this step, the virtual torpedo component would contain the values
 * of the F3 type where these are better while retaining the 20km range of the
 * stock tubes. 
 * 4. Apply the advantages of all available modules, even though some of them
 * are mutually exclusive. Disadvantages are ignored: For example Main Battery Mod 3 
 * improves firing rate at the cost of traverse time. This step will only 
 * improve the firing rate but leave the traverse time the same.
 * 5. Equip all available consumables, even though some of them are mutually
 * exclusive. A Des Moines, for example, will then have radar, fighters, and spotter 
 * plane, even though these are really all in the same consumable slot.
 * 6. Apply the advantageous effects of all commander skills.
 *
 * The first two of these steps are assumed to be completed when instantiating
 * this class.
 */
class Ship extends GameObject {

	researchPaths;

	constructor(data) {
		super(data);

		var self = this;
		self.researchPaths = self.getResearchPaths();
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

		// Helper method that returns true if the argument is an 
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
				else
					// Take the appropriate research path from researchPaths (which we know,
					// because we chose ucType as the key for it) and find the index of that 
					// element in it that has prev as the value for 'quartersbrief_name' - 
					// this used to be the object key in the original file before we threw that
					// information away. The insertion point is the index after that.
					index = researchPaths[upgrade.ucType]
						.findIndex(u => u['quartersbrief_name'] === upgrade.prev) + 1;

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

}

module.exports = Ship;