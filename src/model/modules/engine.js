import Module from './module.js';
import Modifier from '../modifier.js';

export default class Engine extends Module {
	getModifiers() {
		return [ ...Modifier.from('speedCoef', this._data.speedCoef) ];
	}
}
