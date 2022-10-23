import rootlog from 'loglevel';
import { GameObject } from './gameobject.js';
import { Ship } from './ship.js';
import { Modernization } from './modernization.js';
import { Consumable } from './consumable.js';
import { Captain } from './captain.js';
import { Camouflage } from './camouflage.js';
import { Signal } from './signal.js';
import { Gun } from './gun.js';
import * as DotNotation from '../util/dotnotation.js';
import clone from 'clone';

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
			'ShipUpgradeInfo.*.nextShips', 
			// Blacklisted to prevent infinite nesting of requested ship when resolving
			// (Requested ship itself will have a "name" property, which would otherwise
			// get resolved)
			'name', 
			// Actual WoWS name for what we call a reference code. 
			// Blacklisted for the same reason as "name" (see above)
			'index', 
			// Previous module in ShipUpgradeInfo modules. Some modules have names that
			// would fit the naming convention for game objects.
			'ShipUpgradeInfo.*.prev',
			// Whitelist and blacklist for modernizations
			'ships', 'excludes',
			// Whitelist and blacklist for camouflages
			'restrictions.specificShips', 'restrictions.forbiddenShips', 
			// These seem to refer to UI localization resources that are not available
			// in GameParams.data
			'*.titleIDs', '*.descIDs', '*.iconIDs',
			// Omit attached labels from expansion
			'label'
		];

	/**
	 * This property controls what specific classes will be instantiated for a given `typeinfo.type`
	 * by `createGameObject` (or, more specifically, `_convert`). 
	 * It is a hash from `typeinfo.type` to constructor functions.
	 */
	static KNOWN_TYPES = {
		'Ship': Ship,
		'Modernization': Modernization,
		'Ability': Consumable,
		'Crew': Captain,
		'Exterior': { 
			'Camouflage': Camouflage,
			'Permoflage': Camouflage,
			'Skin': Camouflage,
			'Flags': Signal
		},
		'Gun': Gun
	}

	/**
	 * Private helper property that holds translations for numeric IDs to reference names.
	 */
	#idToName;
	/**
	 * Private helper property that holds translations for reference codes to reference names.
	 */
	#refcodeToName;

	/**
	 * Private property that holds the loaded
	 * GameParams data in toto.
	 * @private
	 */
	#data;

	constructor(data, labeler) {		
		this.setData(data);
		this.labeler = labeler;
	}

	/**
	 * Expands references within `data` to their corresponding definitions. That is, for any (possibly nested) string
	 * property on `data` that is a reference name, the property's value is replaced by the object for that name 
	 * within this `GameObjectFactory`'s data.
	 * @param  {Object} data The object to expand references on. Not expected to be a `GameObject`.
	 * @return {Object}      `data`, with any references expanded to their corresponding objects. This method does _not_
	 * return a `GameObject`.
	 */
	_expandReferences(data, partialPath) {
		let self = this;
		let dedicatedlog = rootlog.getLogger(self.constructor.name);

		// Iterate over all keys in the current object
		for (let key in data) {
			// Therefore, omit certain keys from reference resolution. See
			// JSDoc comment for IGNORED_KEYS.
			if (GameObjectFactory.IGNORED_KEYS.some(ignore => DotNotation.matches(ignore, DotNotation.join(partialPath, key)))) {
				continue;
			}

			// If the current key's value is a reference name, replace the code with
			// its actual content.
			if (typeof data[key] === 'string' && data[key].match(GameObject.REFERENCE_NAME_REGEX)) {				
				dedicatedlog.debug(`Found reference ${data[key]} on key ${key}`)
				// Only replace if the reference could actually be expanded
				// If not, just keep the reference in there
				// This can be the case with some unfortunately-named components
				// in game files.
				// See e.g. PASA010_Ranger_1944, where the planes are called
				// PAUB002_Grumman_TBF, and then referenced as such in the
				// shipUpgradeInfo fields, rather than the AB1_DiveBomber scheme
				// most other files use. This matches the regex, obviously, but
				// no data of that refcode will be found in #data.
				// let expanded = clone(self.#data.get(data[key]));
				// let expanded = self.createGameObject(data[key]);

				const self = this;
				const reference = data[key];
				dedicatedlog.debug(`Creating lazy expansion for ${reference} on ${key}`);
				Object.defineProperty(data, key, {
					get: function() {
						const expanded = self.createGameObject(reference);						
						Object.defineProperty(this, key, {
							value: expanded ?? reference,
							writable: true,
							configurable: true,
							enumerable: true
						});
						if (expanded)
							dedicatedlog.debug(`Expanded reference ${reference} on ${key}`);
						else
							dedicatedlog.debug(`Unable to expand reference ${reference} on ${key}, target unknown. The reference has been ignored.`);						
						return expanded;
					},
					set: function(val) {
						Object.defineProperty(this, key, {
							value: val,
							writable: true,
							enumerable: true,
							configurable: true
						});
						dedicatedlog.debug(`Overwrote lazily expanding reference ${reference} on ${key}`);
					},
					configurable: true,
					enumerable: true,
				});
			}
			// If the current key's value is an object, expand references recursively
			else if (typeof data[key] === 'object' && data[key] !== null) {
				data[key] = self._expandReferences(data[key], DotNotation.join(partialPath, key));
			}
		}
		return data;
	}

	/**
	 * Converts the passed data into a corresponding game object as per the `data`'s
	 * `typeinfo.type` field. If there are several known game objects for that `type`, 
	 * the exact one is determined by the `typeinfo.species` field.
	 * If no `typeinfo` property exists on `data`, it is returned as-is. 
	 * 
	 * Any nested game objects are converted as well.
	 * @param  {Object} data The data to convert.
	 * @return {GameObject}      If `data` had a `typeinfo.type` field, returns `data` converted into a `GameObject`.
	 * Otherwise returns the raw `data`, with any nested objects converted if appropriate.
	 */
	_convert(data) {
		const dedicatedlog = rootlog.getLogger(this.constructor.name);

		if (!(data?.typeinfo?.type)) {
			dedicatedlog.debug(`Returning object ${data?.name ?? data} as-is because it has no typeinfo.type`);
			return data;
		}

		let logstr = `Converting object ${data.name} of type ${data.typeinfo.type}`;

		let Constructor = GameObjectFactory.KNOWN_TYPES[data.typeinfo.type];

		if (typeof Constructor === 'object') {
			logstr += ` and species ${data.typeinfo.species}`;
			Constructor = Constructor[data.typeinfo.species];
		}

		if (!Constructor) Constructor = GameObject;

		logstr += ` into a ${Constructor.name}`;
		dedicatedlog.debug(logstr);

		return new Constructor(data);
	}

	/**
	 * Creates a game object for the object with the given designator. 
	 * If the object was requested before, it will be read from cache. 
	 * Otherwise, it will be constructed. 
	 *
	 * References in the created game object are expanded: Any keys within the created
	 * game object detected to be reference names will be replaced with the corresponding
	 * game object.
	 * 
	 * @param  {Number|String} designator The designator for the object
	 * to get. This can either be a number, in which case it will be assumed
	 * to be the object's ID. Or it can be a string, in which case it will
	 * be assumed to be the object's reference code.
	 * @return {GameObject} The game object for that designator.
	 * @throws Will throw an error ("No data set") if the GameObjectManager's data has not
	 * been set using {@link GameObjectFactory#setData}.
	 * @throws Will throw an error ("Invalid argument") if a malformed
	 * designator is passed.
	 */
	createGameObject(designator) {
		let self = this;
		let dedicatedlog = rootlog.getLogger(self.constructor.name);

		let t0 = Date.now();
		dedicatedlog.debug('Creating game object for designator ' + designator)
		
		self.#checkData();

		let gameObject;
		
		if (typeof designator === 'number') { // designator is an ID
			// Find an object that has an 'id' property the same as designator
			gameObject = this.#data.get(this.#idToName.get(designator));
		} else if (typeof designator === 'string' && GameObject.REFERENCE_CODE_REGEX.test(designator)) { // designator is a ref code
			// Find an object that has an 'index' property the same as designator
			gameObject = this.#data.get(this.#refcodeToName.get(designator));
		} else if (typeof designator === 'string' && GameObject.REFERENCE_NAME_REGEX.test(designator)) { // designator is a ref name
			// Access self.#data directly, as reference names are already its keys
			gameObject = this.#data.get(designator);
		} else
			throw new Error(`Invalid argument. ${designator} is not a valid designator. Provide either a numeric ID, a reference name or a reference code.`);
		
		if (!gameObject) {
			rootlog.error(`Could not find game object for ${designator}`);
			return null;
		}

		gameObject = clone(gameObject);
		{
			let t0 = Date.now();
			gameObject = self._expandReferences(gameObject);
			dedicatedlog.debug(`Expanded references for ${designator} in ${Date.now() - t0}ms`);
		}
		gameObject = this.labeler?.label(gameObject) ?? gameObject;
		gameObject = self._convert(gameObject);

		rootlog.debug(`Retrieved ${gameObject.getType().toLowerCase()} ${gameObject.getName()} in ${Date.now() - t0}ms`);
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
		this.#checkData();

		let result = Array.from(this.#data.values())
			.filter(obj => obj.typeinfo && obj.typeinfo.type === type)
			.map(obj => obj.index);
		rootlog.getLogger(this.constructor.name).debug(`Got all ref codes for type ${type} - found ${result.length} matches.`);
		return result;
	}

	setData(data) {
		// Generator function to avoid having to create an intermediate array, as Object.entries(data) would
		function* entries(data) {
			for (let key in data)
				yield [key, data[key]];
		}
		// Generator function that yields translations from numeric ID to reference name
		function* idToNameEntries(data) {
			for (let key in data)
				yield [data[key].id, key];
		}
		function* refcodeToNameEntries(data) {
			for (let key in data)
				yield [data[key].index, key];
		}

		if (!data) return;

		const t0 = Date.now();
		this.#data = new Map(entries(data));
		this.#idToName = new Map(idToNameEntries(data));
		this.#refcodeToName = new Map(refcodeToNameEntries(data));

		rootlog.getLogger(this.constructor.name).debug(`Set data in ${Date.now() - t0}ms`);
	}

	/**
	 * Checks that this#data has been set, throws if it hasn't
	 * @throws Throws an error if this.#data is `null` or `undefined`.
	 * @private
	 */
	#checkData() {
		if (!this.#data)
			throw new Error('No data set. Make sure to set data using setData before requesting.');
	}
}

export { GameObjectFactory }