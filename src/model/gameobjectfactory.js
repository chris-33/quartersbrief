import rootlog from 'loglevel';
import clone from 'just-clone';
import { GameObject } from './gameobject.js';
import { Ship } from './ship.js';
import { Modernization } from './modernization.js';
import { Consumable } from './consumable.js';
import { Captain } from './captain.js';
import { Camouflage } from './camouflage.js';
import template from 'pupa';
import { ComplexDataObject } from '../util/cdo.js'
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
			// Previous module in ShipUpgradeInfo modules. Some modules have names that
			// would fit the naming convention for game objects.
			'prev',
			// Whitelist and blacklist for modernizations
			'ships', 'excluded',
			// These seem to refer to UI localization resources that are not available
			// in GameParams.data
			'titleIDs', 'descIDs', 'iconIDs',
			// Omit attached labels from expansion
			'qb_label'
		];

	// We can't use template literals (`${foo}`) here, because their interpolation cannot be deferred,
	// and right now there is no context to allow their interpolation.
	// So we use a templating engine (pupa) here, and interpolate at runtime in the attachLabel method.
	// These are regular strings, and there is no $ in front of the expressions to be interpolated.
	static LABEL_KEYS = {
		'Ship': 'IDS_{index}_FULL',
		'Modernization': 'IDS_TITLE_{name}',
		'Crew': 'IDS_{CrewPersonality.personName}',
		'Projectile': 'IDS_{name}',
		'Gun': 'IDS_{name}'
	}
	
	/**
	 * Private property that holds the loaded
	 * GameParams data in toto.
	 * @private
	 */
	#data;

	/**
	 * Private property that holds the loaded
	 * human-readable label strings.
	 * @private
	 */
	#labels;

	constructor(data, labels) {
		this.setData(data);
		this.#labels = labels;
	}

	/**
	 * Transforms the passed data into an instance of `GameObject` or a descendant class based on 
	 * its `typeinfo.type` property. Any contained game objects are transformed as well. The return type
	 * will be as follows:
	 *
	 * - If `data` is a primitive, `null` or `undefined`, it will be returned.
	 * - If `data` is an `object`, it is cloned and its properties are deep transformed in turn.
	 * - If `data` is an `object` and has a `typeinfo` property, the return type depends on the value of `typeinfo.type`:
	 * 
	 *     `typeinfo.type`|return type
	 *     --------|--------
	 *     `'Ship'`|`Ship`
	 *     `'Modernization'`|`Modernization`
	 *     `'Ability'`|`Consumable`
	 *     `'Crew'`|`Captain`
	 *     `'Exterior'`|`Camouflage`
	 *     any other|`GameObject`
	 * 
	 * @param  {*} data The data which to attempt transformation on.
	 * @return {*}     If `data` was an `object` with a `typeinfo.type` property, a `GameObject` or
	 * descendant as detailed above. 
	 */
	deepTransform(data) {
		if (data === null || data === undefined) return data;
		// Clone data to avoid changing this GameObjectFactory's data:
		// Anytime an object is changed into a GameObject, all its contained
		// objects will be turned into a ComplexDataObject, and if we did this
		// in-place, it would pollute the GameObjectFactory's source data. This would cause
		// problems any time we iterate over object properties (for example in expandReferences)
		if (typeof data === 'object')
			data = clone(data);

		for (let key in data) {
			if (typeof data[key] === 'object')
				data[key] = this.deepTransform(data[key]);
		}
		if (data.typeinfo) {
			let Constructor = {
				'Ship': Ship,
				'Modernization': Modernization,
				'Ability': Consumable,
				'Crew': Captain,
				'Exterior': Camouflage
			}[data.typeinfo.type];
			if (!Constructor) Constructor = GameObject;

			rootlog.getLogger(this.constructor.name).debug(`Turned object of ${data.typeinfo.type} into instance of ${Constructor}`);
			return new Constructor(data);
		} else return data;
	}

	expandReferences(data) {
		let dedicatedlog = rootlog.getLogger(this.constructor.name);

		// Iterate over all keys in the current object
		for (let key of Object.keys(data)) {
			// Therefore, omit certain keys from reference resolution. See
			// JSDoc comment for IGNORED_KEYS.
			if (GameObjectFactory.IGNORED_KEYS.includes(key)) {
				dedicatedlog.debug(`Ignored key ${key} because it is blacklisted`);	
				continue;
			}

			let expanded = false;
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
				// no data of that refcode will be found in #data.
				expanded = this.#data[data[key]]; //self.createGameObject(data[key]);
				if (expanded) {
					dedicatedlog.debug(`Expanded reference ${data[key]}`);
					data[key] = expanded;
				} else {
					dedicatedlog.debug(`Unable to expand reference ${data[key]}, target unknown. The reference has been ignored.`);
				}	
			}
			// If the current key's value is an object, resolve it recursively. (This includes arrays.)
			if (typeof data[key] === 'object' && data[key] !== null) {
				data[key] = this.expandReferences(data[key]);
			}
		}
		return data;
	}

	/** 
	 * Attaches a human-readable label to the provided `data` object. The label is looked up depending
	 * on ``data.typeinfo.type`. If this `GameObjectFactory` instance was created without the second parameter, 
	 * or if `data` does not have a `typeinfo.type` property, it does nothing.
	 * @param {*} data The `data` to attach the label to.
	 * @returns {Object} Returns `data`, with a label attached under `qb_label`.
	 */
	attachLabel(data) {
		data = clone(data);
		if (this.#labels) {
			let key = GameObjectFactory.LABEL_KEYS[data.typeinfo?.type];
			if (!key) return data;
			key = template(key, data).toUpperCase();
			data.qb_label = this.#labels[key];
			// @todo Find a way to attach labels to captain skills and consumable flavors (flavors may be different than the base - e.g. Crawling Smoke Generator is a flavor of Smoke Generator)
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
			gameObject = Object.values(self.#data).find(obj => obj.id && obj.id === designator);
		} else if (typeof designator === 'string' && GameObject.REFERENCE_CODE_REGEX.test(designator)) { // designator is a ref code
			// Find an object that has an 'index' property the same as designator
			gameObject = Object.values(self.#data).find(obj => obj.index && obj.index === designator);
		} else if (typeof designator === 'string' && GameObject.REFERENCE_NAME_REGEX.test(designator)) { // designator is a ref name
			// Access self.#data directly, as reference names are already its keys
			gameObject = self.#data[designator];
		} else
			throw new Error(`Invalid argument. ${designator} is not a valid designator. Provide either a numeric ID, a reference name or a reference code.`);

		if (gameObject.typeinfo.type === 'Ship') {
			let t0 = Date.now();
			gameObject = self.expandReferences(gameObject);
			dedicatedlog.debug(`Expanded references for ${designator} in ${Date.now() - t0}ms`);
		}
		gameObject = self.attachLabel(gameObject);
		
		gameObject = this.deepTransform(gameObject);
		rootlog.debug(`Retrieved ${gameObject.getType().toLowerCase()} ${gameObject.name} in ${Date.now() - t0}ms`);
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

		let result = Object.values(this.#data)
			.filter(obj => obj.typeinfo && obj.typeinfo.type === type)
			.map(obj => obj.index);
		rootlog.getLogger(this.constructor.name).debug(`Got all ref codes for type ${type} - found ${result.length} matches.`);
		return result;
	}

	setData(data) {
		this.#data = data;
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