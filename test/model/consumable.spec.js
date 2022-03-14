import { Consumable } from '../../src/model/consumable.js';
import { readFileSync } from 'fs';

describe('Consumable', function() {
	let TEST_DATA;

	before(function() {
		TEST_DATA = JSON.parse(readFileSync('test/model/testdata/consumable.json')).PCY001_Consumable1;
	});

	it('should error when trying to get properties other than typeinfo, name, index and id without a set flavor', function() {
		let consumable = new Consumable(TEST_DATA);
		for (let prop of ['typeinfo', 'name', 'index', 'id'])
			expect(consumable.get.bind(consumable, prop)).to.not.throw();
		expect(consumable.get.bind(consumable, 'prop')).to.throw();
		consumable.setFlavor('Flavor1');
		expect(consumable.get.bind(consumable, 'prop')).to.not.throw();
	});

	it('should get properties typeinfo, name, index and id on itself and refer others to the set flavor', function() {
		let consumable = new Consumable(TEST_DATA);
		consumable.setFlavor('Flavor1');
		for (let key of ['id', 'index', 'name'])
			expect(consumable.get(key)).to.equal(TEST_DATA[key]);
		for (let key of ['type','nation','species'])
			expect(consumable.get(`typeinfo.${key}`)).to.equal(TEST_DATA.typeinfo[key]);

		expect(consumable.get('prop')).to.equal(TEST_DATA.Flavor1.prop);
	});
})