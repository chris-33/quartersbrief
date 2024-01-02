import clone from 'lodash/cloneDeep.js';
import Weapon from '../../src/model/modules/weapon.js';
import Gun from '../../src/model/gun.js';

describe('Weapon', function() {
	const TEST_DATA = {
		Gun1: {
			value: 1,
			ammoList: []
		},
		Gun2: {
			ammoList: []
		}
	}
	let weapon;
	beforeEach(function() {
		const data = clone(TEST_DATA);
		data.Gun1 = new Gun(data.Gun1);
		data.Gun2 = new Gun(data.Gun2);		
		weapon = new Weapon(null, data);
		// [ 1, 2 ].forEach(i => Object.defineProperty(weapon, `Gun${i}`, {
		// 	get: function() { return this._data[`Gun${i}`]},
		// 	enumerable: true
		// }));
	});

	it('should have a property mounts with all gun mounts', function() {
		expect(weapon.mounts).to.exist;
		expect(weapon.mounts.map(gun => gun._data)).to.deep.equal([ TEST_DATA.Gun1, TEST_DATA.Gun2 ]);
	});

	it('should be able to get from mounts', function() {
		expect(weapon.get('mounts.0')).to.exist;
	});

	it('should be able to multiply into mounts', function() {
		const coeff = 2;
		Object.defineProperty(weapon._data.Gun1, 'value', {
			get: function() { return this._data.value },
			set: function(value) { this._data.value = value },
			enumerable: true
		});
		weapon.multiply('mounts.0.value', coeff);
		expect(weapon._data.Gun1.value).to.equal(TEST_DATA.Gun1.value * coeff);
	});
});