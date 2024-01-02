import DataObject from '../dataobject.js';

export default class Module extends DataObject {
	constructor(ship, data) {
		super(data);
		this._ship = ship;
	}
}