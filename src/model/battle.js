import DataObject, { expose } from './dataobject.js';

export default class Battle extends DataObject {
	
	get player () { 
		return this._data.vehicles.find(vehicle => vehicle.relation === this._data.playerID);
	}

	get allies() {
		return this._data.vehicles.filter(vehicle => vehicle.relation === 1);
	}

	get enemies() {
		return this._data.vehicles.filter(vehicle => vehicle.relation === 2);
	}
}
expose(Battle, {
	'vehicles': 'vehicles',
	'mapName': 'mapName'
})