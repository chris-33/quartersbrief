import Module from './module.js';
import Modifier from '../modifier.js';

export default class Engine extends Module {
	getModifiers() {
		return [ 'speedCoef' ].map(target => Modifier.from(target, this._data[target]));
	}
}
