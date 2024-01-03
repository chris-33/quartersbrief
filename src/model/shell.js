import GameObject from './gameobject.js';
import { expose } from './dataobject.js';
import { compile } from 'object-selectors';

const 
	ALPHA_PIERCING_HE = compile('alphaPiercingHE'),
	ALPHA_PIERCING_CS = compile('alphaPiercingCS');

export default class Shell extends GameObject {
	get ammoType() {
		let result = this._data.ammoType.toLowerCase();
		if (result === 'cs') result = 'sap';
		return result;
	}

	get pen() {
		switch (this.ammoType) {
			case 'he': return ALPHA_PIERCING_HE.get(this._data);
			case 'sap': return ALPHA_PIERCING_CS.get(this._data);
			default: return undefined;
		}
	}

	set pen(x) {
		switch (this.ammoType) {
			case 'he': ALPHA_PIERCING_HE.set(this._data, x); break;
			case 'sap': ALPHA_PIERCING_CS.set(this._data, x); break;
		}
	}
}
Object.defineProperty(Shell.prototype, 'ammoType', { enumerable: true });
Object.defineProperty(Shell.prototype, 'pen', { enumerable: true });
expose(Shell, {
	'alphaDamage': 'alphaDamage'
});