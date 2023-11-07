import rootlog from 'loglevel';
import GameObjectSupplier from './gameobjectsupplier.js';
import clone from 'clone';

import GameObject from '../model/gameobject.js';
import Ship from '../model/ship.js';
import Modernization from '../model/modernization.js';
import Consumable from '../model/consumable.js';
import Captain from '../model/captain.js';
import Camouflage from '../model/camouflage.js';
import Signal from '../model/signal.js';
import Gun from '../model/gun.js';
import Torpedo from '../model/torpedo.js';

/**
 * @see GameObject
 */
export default class GameObjectProvider {
	/**
	 * The default object conversion table, mapping `typeinfo.type` values to their corresponding
	 * constructors. 
	 * If the target of the mapping is an object, the `typeinfo.species` value will also be examined for determining
	 * the constructor. 
	 * The following example uses the `Baz` constructor for game objects where `typeinfo.type === 'Foo'` and `typeinfo.species === 'Bar'`:
	 * ```
	 * 	{
	 * 		'Foo': {
	 * 			'Bar': Baz
	 * 	  	}
	 *  }
	 * ```
	 * @type {Object}
	 */
	static CONVERSIONS = {
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
		'Gun': Gun,
		'Projectile': {
			'Torpedo': Torpedo
		}
	}

	static EXPANSIONS = {
		'Gun': [
			'ammoList.*'
		],
		'Ship': [
			'*_Artillery.*[typeinfo.type===Gun]',
			'ShipAbilities.AbilitySlot*.abils' 
		]
	}

	constructor(sourcepath) {		
		this.supplier = new GameObjectSupplier(sourcepath, GameObjectProvider.EXPANSIONS, GameObjectProvider.CONVERSIONS);
	}

	/**
	 * Creates a game object for the object with the given designator. 
	 * If the object was requested before, it will be read from cache. 
	 * Otherwise, it will be constructed. 
	 *
	 * References in the created game object are expanded as per `GameObjectProvider.EXPANSIONS`. This includes "inline" 
	 * references, i.e. properties that are themselves full-fledged game objects.
	 * 
	 * @param  {Number|String} designator The designator for the object
	 * to get. This can either be a number, in which case it will be assumed
	 * to be the object's ID. Or it can be a string, in which case it will
	 * be assumed to be the object's reference code.
	 * @return {GameObject} The game object for that designator.
	 * @throws Will throw an error ("Invalid argument") if a malformed
	 * designator is passed.
	 */
	async createGameObject(designator) {	
		let dedicatedlog = rootlog.getLogger(this.constructor.name);

		let t0 = Date.now();
		dedicatedlog.debug('Creating game object for designator ' + designator)
		
		// Check if we have a valid designator
		if (!designator || (typeof designator !== 'number' && !GameObject.REFERENCE_CODE_REGEX.test(designator) && !GameObject.REFERENCE_NAME_REGEX.test(designator))) 
			throw new Error(`Invalid argument. ${designator} is not a valid designator. Provide either a numeric ID, a reference name or a reference code.`);
		
		let gameObject = await this.supplier.get(designator);
		if (!gameObject) {
			rootlog.error(`Could not find game object for ${designator}`);
			return null;
		}

		// @todo Remove explicit data copying once GameObject has been moved over to object-selectors
		gameObject = new gameObject.constructor(clone(gameObject._data));		

		rootlog.debug(`Retrieved ${gameObject.getType().toLowerCase()} ${gameObject.getName()} in ${Date.now() - t0}ms`);
		return gameObject; 
	}
}