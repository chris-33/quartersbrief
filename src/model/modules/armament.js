import { expose } from '../dataobject.js';
import Module from './module.js';
import Gun from '../gun.js';

/**
 * This is the base class for any armament module. Armaments are any module on a ship that fire projectiles
 * from one or more weapon mounts.
 * For example, torpedo launchers, main and secondary artillery, and depth charge launchers are all armaments.
 */
export default class Armament extends Module {
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
expose(Armament, {
	'reload': 'shotDelay'
});
[ 'mounts', 'dpm' ].forEach(prop => Object.defineProperty(Armament.prototype, prop, { enumerable: true }));
