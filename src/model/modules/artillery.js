import Armament from './armament.js';
import { compile } from 'object-selectors';

const 
	CALIBER = compile('mounts.*.caliber'),
	MAX_RANGE = compile('mounts.*.maxRange');

export default class Artillery extends Armament {
	/** Main artillery caliber in mm. */
	get caliber() { return 1000 * CALIBER.get(this, { collate: true }); }

	get maxRange() { return MAX_RANGE.get(this, { collate: true }); }
}
[ 'caliber', 'maxRange' ].forEach(prop => Object.defineProperty(Artillery.prototype, prop, { enumerable: true }));