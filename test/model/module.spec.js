import clone from 'lodash/cloneDeep.js';
import { Module, Weapon } from '../../src/model/module.js';

/* eslint-disable mocha/max-top-level-suites */

describe('Weapon', function() {
	const TEST_DATA = {
		Gun1: {
			value: 1,
			typeinfo: { type: 'Gun' }
		},
		Gun2: {
			typeinfo: { type: 'Gun' }
		}
	}
	let weapon;
	beforeEach(function() {
		weapon = new Weapon(null, clone(TEST_DATA));
	});

	it('should have a property mounts with all gun mounts', function() {
		expect(weapon.mounts).to.exist;
		expect(weapon.mounts).to.deep.equal([ TEST_DATA.Gun1, TEST_DATA.Gun2 ]);
	});

	it('should be able to get from mounts', function() {
		expect(weapon.get('mounts.0')).to.exist;
	});

	it('should be able to multiply into mounts', function() {
		const coeff = 2;
		weapon.multiply('mounts.0.value', coeff);
		expect(weapon.get('Gun1.value')).to.equal(TEST_DATA.Gun1.value * coeff);
	});
});