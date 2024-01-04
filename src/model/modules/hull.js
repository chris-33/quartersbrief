import Module from './module.js';
import { expose } from '../dataobject.js';
import { compile } from 'object-selectors';

const
	VISIBILITY_FACTOR = compile('visibilityFactor'),
	VISIBILITY_FACTOR_BY_PLANE = compile('visibilityFactorByPlane'),
	VISIBILITY_COEF_G_K_IN_SMOKE = compile('visibilityCoefGKInSmoke');

export default class Hull extends Module {
	get concealment(){
		const hull = this;
		return {
			get sea() { return VISIBILITY_FACTOR.get(hull._data); },
			set sea(x) { VISIBILITY_FACTOR.set(hull._data, x); },

			get air() { return VISIBILITY_FACTOR_BY_PLANE.get(hull._data); },
			set air(x) { VISIBILITY_FACTOR_BY_PLANE.set(hull._data, x); },

			get smokeFiring() { return VISIBILITY_COEF_G_K_IN_SMOKE.get(hull._data); },
			set smokeFiring(x) { VISIBILITY_COEF_G_K_IN_SMOKE.set(hull._data, x); },
		}
	} 
}
expose(Hull, {
	'health': 'health',
	'armor': 'armor',
	'model': 'model'
});