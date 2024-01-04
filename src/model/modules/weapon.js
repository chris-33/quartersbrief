import { expose } from '../dataobject.js';
import Module from './module.js';
import Gun from '../gun.js';

/**
 * This is the base class for any weapon module. Weapons are any module on a ship that fire projectiles
 * from one or more weapon mounts.
 * For example, torpedo launchers, main and secondary artillery, and depth charge launchers are all weapons.
 */
export default class Weapon extends Module {
	get mounts() {
		return Object.values(this._data).filter(obj => obj instanceof Gun);
	}

	get dpm() {
		return this.mounts
			.map(mount => mount.dpm)
			.reduce((prev, curr) => {
				for (let ammoType in curr) 
					prev[ammoType] = (prev[ammoType] ?? 0) + curr[ammoType]
				return prev;
			}, {})
	}
}
expose(Weapon, {
	'reload': 'shotDelay'
});
Object.defineProperty(Weapon.prototype, 'mounts', { enumerable: true });
