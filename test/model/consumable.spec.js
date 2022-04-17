import { Consumable } from '../../src/model/consumable.js';
import { readFileSync } from 'fs';
import clone from 'clone';

describe('Consumable', function() {
	let TEST_DATA;
	let exposedFlavorProperties;
	let consumable;

	before(function() {
		TEST_DATA = JSON.parse(readFileSync('test/model/testdata/consumable.json')).PCY001_Consumable1;
	});

	before(function() {
		exposedFlavorProperties = Consumable.EXPOSED_FLAVOR_PROPERTIES;
		Consumable.EXPOSED_FLAVOR_PROPERTIES = [ 'value', 'arbitraryothervalue' ];
	});

	after(function() {
		Consumable.EXPOSED_FLAVOR_PROPERTIES = exposedFlavorProperties;
	});

	beforeEach(function() {
		consumable = new Consumable(clone(TEST_DATA));
	});

	describe('.setFlavor', function() {
		it('should expose properties of the flavor', function() {
			expect(consumable).to.not.have.property('value');
			consumable.setFlavor('Flavor1');
			expect(consumable).to.have.property('value');
		});

		it('should unset previously exposed properties when setting flavors', function() {
			consumable.setFlavor('Flavor1');
			// Pretend that the set flavor set the key "arbitraryothervalue"
			consumable.arbitraryothervalue = 42;
			consumable.setFlavor('Flavor2');
			expect(consumable).to.not.have.property('arbitraryothervalue');
		});
	});

	it('should error when trying to get properties other than typeinfo, name, index and id without a set flavor', function() {
		for (let prop of ['typeinfo', 'name', 'index', 'id'])
			expect(consumable.get.bind(consumable, prop)).to.not.throw();
		expect(consumable.get.bind(consumable, 'prop')).to.throw();
		consumable.setFlavor('Flavor1');
		expect(consumable.get.bind(consumable, 'prop')).to.not.throw();
	});

	it('should get properties typeinfo, name, index and id on itself and refer others to the set flavor', function() {
		consumable.setFlavor('Flavor1');
		for (let key of ['id', 'index', 'name'])
			expect(consumable.get(key)).to.equal(TEST_DATA[key]);
		for (let key of ['type','nation','species'])
			expect(consumable.get(`typeinfo.${key}`)).to.equal(TEST_DATA.typeinfo[key]);

		expect(consumable.get('prop')).to.equal(TEST_DATA.Flavor1.prop);
	});
})