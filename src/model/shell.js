import GameObject from './gameobject.js';
import { expose } from './dataobject.js';
import { compile } from 'object-selectors';

export default class Shell extends GameObject {
	get ammoType() {
		let result = this._data.ammoType.toLowerCase();
		if (result === 'cs') result = 'sap';
		return result;
	}
}
expose(Shell, {
	'penHE': 'alphaPiercingHE',
	'penSAP': 'alphaPiercingCS',
	'alphaDamage': 'alphaDamage'
});