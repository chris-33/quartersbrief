import Torpedo from '../../src/model/torpedo.js';
import clone from 'lodash/cloneDeep.js';

describe('Torpedo', function() {
	const TORPEDO = {
		alphaDamage: 100,
		damage: 200
	}
	let torpedo;

	beforeEach(function() {
		torpedo = new Torpedo(clone(TORPEDO));
	});

	it('should have correctly calculated property damage for total damage', function() {
		const expected = TORPEDO.alphaDamage / 3 + TORPEDO.damage;

		expect(torpedo).to.have.property('damage').that.equals(expected);
	});

	it('should adjust alphaDamage and damage in the data when writing to property damage', function() {
		const factor = 2;

		torpedo.damage *= factor;

		expect(torpedo._data.alphaDamage).to.equal(factor * TORPEDO.alphaDamage);
		expect(torpedo._data.damage).to.equal(factor * TORPEDO.damage);
	});
});