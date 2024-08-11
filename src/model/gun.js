import { expose } from './dataobject.js';
import GameObject from './gameobject.js';
import { compile } from 'object-selectors';
import { BW_TO_METERS } from '../util/conversions.js';
import * as shot from './shot.js';

const 
	AMMO_LIST = compile('ammoList.*'),
	TAPER_DIST = compile('taperDist'),
	MIN_RADIUS = compile('minRadius'),
	IDEAL_RADIUS = compile('idealRadius'),
	IDEAL_DISTANCE = compile('idealDistance'),
	RADIUS_ON_ZERO = compile('radiusOnZero'),
	RADIUS_ON_DELIM = compile('radiusOnDelim'),
	RADIUS_ON_MAX = compile('radiusOnMax'),
	DELIM = compile('delim'),
	SIGMA_COUNT = compile('sigmaCount');

export default class Gun extends GameObject {
	get ammos() {
		let ammos = {};
		AMMO_LIST.get(this._data).forEach(ammo => ammos[ammo.ammoType ?? ammo.name] = ammo);
		return ammos;
	}

	get dpm() {
		const result = this.ammos;
		for (let ammo in result) {
			result[ammo] = result[ammo].damage * this.barrels * 60 / this.reload;
		}
		return result;
	}

	shoot(range) {
		if (range > this.maxRange)
			return undefined;

		const gunParams = {
			maxRange: this.maxRange,
			taperDist: TAPER_DIST.get(this._data),
			minRadius: MIN_RADIUS.get(this._data) * BW_TO_METERS,
			idealRadius: IDEAL_RADIUS.get(this._data) * BW_TO_METERS,
			idealDistance: IDEAL_DISTANCE.get(this._data) * BW_TO_METERS,
			radiusOnZero: RADIUS_ON_ZERO.get(this._data),
			radiusOnDelim: RADIUS_ON_DELIM.get(this._data),
			radiusOnMax: RADIUS_ON_MAX.get(this._data),
			delim: DELIM.get(this._data),
			sigmaCount: SIGMA_COUNT.get(this._data)
		}

		return {
			dispersion: [ shot.dispersion(range, gunParams), shot.verticalCoeff(range, gunParams) * shot.dispersion(range, gunParams) ],
			expectedMissDistance: [
				shot.expectedHorizontalMissDistance(range, gunParams),
				shot.expectedVerticalMissDistance(range, gunParams)
			]
		}
	}
}
[ 'ammos', 'dpm' ].forEach(prop => Object.defineProperty(Gun.prototype, prop, { enumerable: true }));
expose(Gun, {
	'barrels': 'numBarrels',
	'position': 'position',
	'caliber': 'barrelDiameter',
	'reload': 'shotDelay',
	'maxRange': 'maxDist'
});