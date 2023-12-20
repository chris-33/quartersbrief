import rootlog from 'loglevel';
import GameObjectSupplier from './gameobjectsupplier.js';
import GameObject from '../model/gameobject.js';
import clone from 'lodash.clonedeepwith';


/**
 * @see GameObject
 */
export default class GameObjectProvider {

	constructor(sourcepath, labeler) {
		// Only here for @legacy briefing headline generation
		this.labeler = labeler;
		this.supplier = new GameObjectSupplier(sourcepath, labeler);
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
			throw new TypeError(`Invalid argument. ${designator} is not a valid designator. Provide either a numeric ID, a reference name or a reference code.`);

		let gameObject = await this.supplier.get(designator);

		if (!gameObject) {
			rootlog.error(`Could not find game object for ${designator}`);
			return null;
		}


		// Clone the object, providing a special cloning function for contained GameObjects
		gameObject = clone(gameObject, function cloneGameObject(obj) {
			if (obj instanceof GameObject)
				return new obj.constructor(clone(obj._data))
			// Returns undefined otherwise, which indicates falling back to default cloning mechanism
		});

		rootlog.debug(`Retrieved ${gameObject.getType().toLowerCase()} ${gameObject.getName()} in ${Date.now() - t0}ms`);
		return gameObject; 
	}
}