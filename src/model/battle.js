export default class Battle {
	constructor(data) {
		this._data = data;
	}

	getPlayer() {
		return this._data.vehicles.find(vehicle => vehicle.relation === this._data.playerID);
	}

	getAllies() {
		return this._data.vehicles.filter(vehicle => vehicle.relation === 1);
	}

	getEnemies() {
		return this._data.vehicles.filter(vehicle => vehicle.relation === 2);
	}

	getVehicles() {
		return this._data.vehicles;
	}

	getMapName() {
		return this._data.mapName;
	}
}