import GameObject from './gameobject.js';
import { expose } from './dataobject.js';
import { BW_TO_METERS } from '../util/conversions.js';
import { compile } from 'object-selectors'; 

const
	MAX_DIST = compile('maxDist'),
	ALPHA_DAMAGE = compile('alphaDamage'),
	DAMAGE = compile('damage'),
	UW_CRITICAL = compile('uwCritical');

export default class Torpedo extends GameObject {
	get range() { return BW_TO_METERS * MAX_DIST.get(this._data); }
	set range(x) { MAX_DIST.set(MAX_DIST, x / BW_TO_METERS); }

	get damage() { return ALPHA_DAMAGE.get(this._data) / 3 + DAMAGE.get(this._data); }
	set damage(x) {
		let ratio = x / this.damage;

		ALPHA_DAMAGE.perform(alphaDamage => ratio * alphaDamage, this._data);
		DAMAGE.perform(damage => ratio * damage, this._data);
	}

	get floodChance() { return UW_CRITICAL.get(this._data) * 100; }
	set floodChance(x) { UW_CRITICAL.set(this._data, x / 100); }
}
expose(Torpedo, {
	'speed': 'speed',
	'deepwater': 'isDeepWater',
	'floodChance': 'uwCritical',
	'visibility': 'visibilityFactor',
	'ignoredClasses': 'ignoreClasses'
});