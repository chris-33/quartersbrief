import { expose } from './dataobject.js';
import GameObject from './gameobject.js';
import { get } from 'object-selectors';

export default class Gun extends GameObject {
	get ammos() {
		let ammos = {};
		get('ammoList.*', this).forEach(ammo => ammos[ammo.ammoType] = ammo);
		return ammos;
	}
}
Object.defineProperty(Gun.prototype, 'ammos', { enumerable: true });
expose(Gun, {
	'barrels': 'numBarrels',
	'position': 'position',
	'caliber': 'barrelDiameter'
});