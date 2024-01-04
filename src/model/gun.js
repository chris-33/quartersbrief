import { expose } from './dataobject.js';
import GameObject from './gameobject.js';
import { compile } from 'object-selectors';

const AMMO_LIST = compile('ammoList.*');

export default class Gun extends GameObject {
	get ammos() {
		let ammos = {};
		AMMO_LIST.get(this._data).forEach(ammo => ammos[ammo.ammoType] = ammo);
		return ammos;
	}

	get dpm() {
		const result = this.ammos;
		for (let ammo in result) {
			result[ammo] = result[ammo].damage * this.barrels * 60 / this.reload;
		}
		return result;
	}
}
Object.defineProperty(Gun.prototype, 'ammos', { enumerable: true });
expose(Gun, {
	'barrels': 'numBarrels',
	'position': 'position',
	'caliber': 'barrelDiameter',
	'reload': 'shotDelay'
});