import Weapon from './weapon.js';

export default class Artillery extends Weapon {
	/** Main artillery caliber in mm. */
	get caliber() { return 1000 * this.get('mounts.*.barrelDiameter', { collate: true }); }
}
