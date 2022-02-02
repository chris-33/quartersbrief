import log from 'loglevel';
import { GameObject } from '$/src/model/gameobject.js';
import { Ship } from '$/src/model/ship.js';
import { Modernization } from '$/src/model/modernization.js';

/**
 * @see GameObject
 */
class GameObjectFactory {

	/**
	 * A list of keys that will be ignored during reference resolution.
	 * 
	 * The reason for this is that expanding some references will enlarge the 
	 * result unnecessarily in the best case and, in the worst case, crash the 
	 * program when the call stack exceeds its maximum size. 
	 * 
	 * For example, following the "nextShip" reference on a tech tree ship's upgrade path 
	 * will result in the ship containing full expansions of all ships that are 
	 * researchable (directly or indirectly) from this ship.
	 * In the case of a tier I ship, that means the _entire_ tech tree will be contained.
	 * 
	 * @type {Array}
	 */
	static IGNORED_KEYS = [
			// Blacklisted to prevent full inclusion of following ships in the tech tree
			'nextShips', 
			// Blacklisted to prevent infinite nesting of requested ship when resolving
			// (Requested ship itself will have a "name" property, which would otherwise
			// get resolved)
			'name', 
			// Actual WoWS name for what we call a reference code. 
			// Blacklisted for the same reason as "name" (see above)
			'index', 
		];

	/**
	 * Private property that holds the loaded
	 * GameParams data in toto.
	 * @private
	 */
	#everything;

	expandReferences(data) {
		let self = this;

		// Iterate over all keys in the current object
		for (let key of Object.keys(data)) {
			// Therefore, omit certain keys from reference resolution. See
			// JSDoc comment for IGNORED_KEYS.
			if (GameObjectFactory.IGNORED_KEYS.includes(key)) {
				log.debug(`Ignored key ${key} because it is blacklisted`);	
				continue;
			}

			// If the current key's value is a reference name, replace the code with
			// its actual content.
			if (typeof data[key] === 'string' && data[key].match(GameObject.REFERENCE_NAME_REGEX)) {				
				// Only replace if the reference could actually be expanded
				// If not, just keep the reference in there
				// This can be the case with some unfortunately-named components
				// in game files.
				// See e.g. PASA010_Ranger_1944, where the planes are called
				// PAUB002_Grumman_TBF, and then referenced as such in the
				// shipUpgradeInfo fields, rather than the AB1_DiveBomber scheme
				// most other files use. This matches the regex, obviously, but
				// no data of that refcode will be found in #everything.
				// let expanded = self.#everything[data[key]];
				let expanded = self.createGameObject(data[key]);
				if (expanded) {
					log.debug(`Expanded reference ${data[key]}`);
					data[key] = expanded;
				} else {
					log.debug(`Unable to expand reference ${data[key]}, target unknown. The reference has been ignored.`);
				}	
			}
			// If the current key's value is an...
			switch (typeof data[key]) {
				// ...  object: resolve it recursively.
				case 'object': 
					// Because typeof null === 'object'
					if (data[key] === null) break;
					data[key] = self.expandReferences(data[key]);
					break;
				// ... array: resolve each of its entries recursively.
				case 'array': 
					for (let i = 0; i< data[key].length; i++)
						data[key][i] = self.expandReferences(data[key][i]);
					break;
				// Otherwise keep everything as is.						
				default:
			}
		}
		return data;
	}

	/**
	 * Creates a game object for the object with the given designator. 
	 * If the object was requested before, it will be read from cache. 
	 * Otherwise, it will be constructed.
	 * @param  {Number|String} designator The designator for the object
	 * to get. This can either be a number, in which case it will be assumed
	 * to be the object's ID. Or it can be a string, in which case it will
	 * be assumed to be the object's reference code.
	 * @return {GameObject} The game object for that designator.
	 * @throws Will throw an error ("No data set") if the GameObjectManager's data has not
	 * been set using {@link setEverything}.
	 * @throws Will throw an error ("Invalid argument") if a malformed
	 * designator is passed.
	 */
	createGameObject(designator) {
		let self = this;

		let t0 = Date.now();
		log.debug('Create game object for designator ' + designator)
		
		self.#checkEverything();

		let gameObject;
		
		if (typeof designator === 'number') { // designator is an ID
			// Find an object that has an 'id' property the same as designator
			gameObject = Object.values(self.#everything).find(obj => obj.id && obj.id === designator);
		} else if (typeof designator === 'string' && GameObject.REFERENCE_CODE_REGEX.test(designator)) { // designator is a ref code
			// Find an object that has an 'index' property the same as designator
			gameObject = Object.values(self.#everything).find(obj => obj.index && obj.index === designator);
		} else if (typeof designator === 'string' && GameObject.REFERENCE_NAME_REGEX.test(designator)) { // designator is a ref name
			// Access self.#everything directly, as reference names are already its keys
			gameObject = self.#everything[designator];
		} else
			throw new Error(`Invalid argument. ${designator} is not a valid designator. Provide either a numeric ID, a reference name or a reference code.`);
			
		let Constructor = {
			'Ship': Ship,
			'Modernization': Modernization
		}[gameObject.typeinfo.type];

		if (!Constructor) Constructor = GameObject;
		gameObject = new Constructor(gameObject);
		log.info(`Retrieved ${gameObject.getType().toLowerCase()} ${gameObject.name} in ${Date.now() - t0} ms`);
		return gameObject; 
	}

	/**
	 * Returns a list of ref codes of all the objects whose `typeinfo.type`
	 * property matches the given `type`.
	 * @param  {String} type The type to look for
	 * @return {Array}      A list of ref codes for all the objects that
	 * have that type.
	 * @throws Throws an error if no data has been set. 
	 */
	listCodesForType(type) {
		let self = this;

		log.debug(`Getting all ref codes for type ${type}`);
		self.#checkEverything();

		return Object.values(self.#everything)
			.filter(obj => obj.typeinfo && obj.typeinfo.type === type)
			.map(obj => obj.index);
	}

	setEverything(everything) {
		let self = this;
		self.#everything = everything;
	}

	/**
	 * Checks that this#everything has been set, throws if it hasn't
	 * @throws Throws an error if this.#everything is `null` or `undefined`.
	 * @private
	 */
	#checkEverything() {
		if (!this.#everything)
			throw new Error('No data set. Make sure to set data using setEverything before requesting.');
	}
}

let gameObjectFactory = new GameObjectFactory();

export { gameObjectFactory }