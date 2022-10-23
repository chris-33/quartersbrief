import { includeOwnPropertiesByDefault } from './dataobject.js';
import { GameObject } from './gameobject.js';

export class Gun extends GameObject {
	get ammos() {
		let ammos = {};
		this.get('ammoList.*').forEach(ammo => ammos[ammo.ammoType] = ammo);
		return ammos;
	}
}
Object.defineProperty(Gun.prototype, 'mounts', { enumerable: true });
includeOwnPropertiesByDefault(Gun.prototype);
