import { ComplexDataObject } from '../util/cdo.js';

class Battle extends ComplexDataObject {
	gameObjectFactory;

	constructor(data, gameObjectFactory) {
		super(data);
		this.gameObjectFactory = gameObjectFactory;

		for (let vehicle of this.get('vehicles')) {
			vehicle.ship = gameObjectFactory.createGameObject(vehicle.shipId);
		}
	}

	getPlayer() {
		return this.get('vehicles').find(vehicle => vehicle.relation === this.get('playerID'));
	}

	getAllies() {
		return this.get('vehicles').filter(vehicle => vehicle.relation === 1);
	}

	getEnemies() {
		return this.get('vehicles').filter(vehicle => vehicle.relation === 2);
	}
}

export { Battle }