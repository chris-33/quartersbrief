import Module from './module.js';
import Modifier from '../modifier.js';

export default class FireControl extends Module {
	getModifiers() {
		return [ ...Modifier.from('maxDistCoef', this._data.maxDistCoef) ];
	}
}
