var fs = require('fs/promises');

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
const Ship = class {
	hull;
	artillery;
	atba;
	torpedoes;
	airDefense;
	airSupport;
	airArmament;
	fireControl;

	engine;

	concealment;
	
	/**
	 * Constructs a new ship object from the 
	 * passed data object. It is assumed that all the 
	 * references in that object have been resolved.
	 * 
	 * @param  {Object} obj The data object from which to 
	 * construct the ship.
	 */
	constructor(obj) {
		// Helper function that, given a clue,
		// returns the key in obj that is the top 
		// configuration for the provided clue.
		// Returns undefined if there are no appropriate
		// keys in obj (e.g. on a ship that has no torpedoes)
		function getTopConfigurationKey(clue) {
			return obj
				// Get all keys of the object
				.keys()
				// Select only the ones that contain the "Hull" clue
				// (See comment for KEY_CLUES about why we have to check
				// for containment instead of equality)
				.filter(k => k.includes(KEY_CLUES.HULL))
				// Sort lexicographically
				.sort()
				// Select the last (i.e. highest) element
			
				.pop();
		}
		
		hull = obj[getTopConfigurationKey(KEY_CLUES.HULL)]; 
		artillery = obj[getTopConfigurationKey(KEY_CLUES.ARTILLERY)];
		torpedoes = obj[getTopConfigurationKey(KEY_CLUES.TORPEDOES)];
		fireControl = obj[getTopConfigurationKey(KEY_CLUES.FIRECONTROL)];
		engine = obj[getTopConfigurationKey(KEY_CLUES.ENGINE)];
		
	}


}