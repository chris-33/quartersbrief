import Ship from '../model/ship.js';

/**
 * `ShipBuilder` is a convenience class that allows for easily configuring ships to a desired build. Builds
 * can encompass module configuration, modernizations, captain, captain skills and camouflage.
 */
export default class ShipBuilder {
	/**
	 * The captain to use as a default, when none is provided in the build.
	 */
	static DEFAULT_CAPTAIN = 'PCW001_CrewCommon';

	/**
	 * Creates a new `ShipBuilder` instance.
	 * @param  {GameObjectProvider} gameObjectProvider The game object factory to use when creating game objects during the building process.
	 */
	constructor(gameObjectProvider) {
		this.gameObjectProvider = gameObjectProvider;
	}

	/**
	 * Returns a `Ship` that has the specified build. If a `Ship` instance is passed as the first
	 * argument, the returned ship will be that ship. Otherwise, if the first parameter is a string
	 * or a number, it will be assumed to be a reference code, a reference name or a numeric id, and
	 * a ship will be created using this builder's game object factory.
	 *
	 * If the `ship` parameter is ommitted, the passed `build` must contain a `ship` property specifying
	 * the reference code, reference name or numeric id of a ship.
	 * @param  {Ship|string|number} [ship]  A `Ship` instance to be configured, or a reference name, reference
	 * code or numeric id of a ship to create and configure.
	 * @param  {Object} build The build to apply to the ship.
	 * @param {string} [build.modules] Module descriptor for the module configuration to equip on the ship.
	 * @param {Array} [build.modernizations] An array of (possibly mixed) reference codes, reference names
	 * or numeric ids of modernizations to equip. 
	 * @param {string|number} [build.camouflage] The reference name, reference code or numeric id of a camouflage
	 * to equip on the ship.
	 * @param {Array} [build.signals] An array of (possibly mixed) reference codes, reference names or numeric ids
	 * of signals to hoist.
	 * @param {string|number} [build.captain] The reference name, reference code or numeric id of a captain
	 * to command the ship.
	 * @param {number[]} [build.skills] An array of skill numbers for captain skills to train on the captain
	 * set to command the ship. If `build.captain` is not set, a default captain will be created and used.
	 * @return {Ship}       A `Ship` instance, configured to the passed `build`.
	 */
	async build(ship, build) {
		// If the second parameter is omitted, the method was called in the form build(build)
		// and the ship parameter is actually the build
		if (!build && typeof ship === 'object' && !(ship instanceof Ship)) {
			build = ship;
			ship = build.ship;
		}
		if (typeof ship === 'string' || typeof ship === 'number')
			ship = await this.gameObjectProvider.createGameObject(ship);

		Ship.errorIfNotShip(ship);

		if (build.modules)
			ship.equipModules(build.modules);

		if (build.modernizations) {
			const modernizations = await Promise.all(build
				.modernizations
				.map(designator => this.gameObjectProvider.createGameObject(designator)));
			modernizations.forEach(modernization => ship.equipModernization(modernization));
		}

		// If a captain is specified as part of the build, use that
		let captain = build.captain && await this.gameObjectProvider.createGameObject(build.captain);
		// If there are skills to learn...
		if (build.skills) {
			// ...and no captain was specified, find the default captain for that ship
			// First, see if the ship itself defines a default.
			// (If it does, it will have been expanded to a Captain object.)
			captain = captain ?? ship.get('defaultCrew'); 
			// If not, use the nation-agnostic default captain
			// (There are default captains for each nation, but they seem to all be copies of this one)
			captain = captain ?? await this.gameObjectProvider.createGameObject(ShipBuilder.DEFAULT_CAPTAIN);

			build.skills.forEach(skill => captain.learn(skill));
		}
		if (captain) ship.setCaptain(captain);

		if (build.signals) {
			const signals = await Promise.all(build
				.signals
				.map(designator => this.gameObjectProvider.createGameObject(designator)));
			signals.forEach(signal => ship.hoist(signal));
		}
		
		return ship;
	}
}

export { ShipBuilder }