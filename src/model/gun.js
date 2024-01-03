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
}
Object.defineProperty(Gun.prototype, 'ammos', { enumerable: true });
expose(Gun, {
	'barrels': 'numBarrels',
	'position': 'position',
	'caliber': 'barrelDiameter'
});