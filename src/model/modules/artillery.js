import Armament from './armament.js';

export default class Artillery extends Armament {
	/** Main artillery caliber in mm. */
	get caliber() { return 1000 * this.get('mounts.*.caliber', { collate: true }); }
}
[ 'caliber' ].forEach(prop => Object.defineProperty(Artillery.prototype, prop, { enumerable: true }));