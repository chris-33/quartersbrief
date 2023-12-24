import Consumable from '../../src/model/consumable.js';
import { readFileSync } from 'fs';
import clone from 'lodash/cloneDeep.js';

describe('Consumable', function() {
	let TEST_DATA;
	let exposedFlavorProperties;
	let consumable;

	before(function() {
		TEST_DATA = JSON.parse(readFileSync('test/model/testdata/consumable.json')).PCY001_Consumable1;
	});

	before(function() {
		exposedFlavorProperties = Consumable.EXPOSED_FLAVOR_PROPERTIES;
		Consumable.EXPOSED_FLAVOR_PROPERTIES = [ 'consumableType', 'value', 'arbitraryothervalue' ];
	});

	after(function() {
		Consumable.EXPOSED_FLAVOR_PROPERTIES = exposedFlavorProperties;
	});

	beforeEach(function() {
		consumable = new Consumable(clone(TEST_DATA));
	});

	describe('.setFlavor', function() {
		it('should expose virtual properties of the flavor', function() {
			expect(consumable).to.not.have.property('value');
			consumable.setFlavor('Flavor1');
			expect(consumable).to.have.property('value');
		});

		it('should unset previously exposed virtual properties when setting flavors', function() {
			consumable.setFlavor('Flavor1');
			// Pretend that the set flavor set the key "arbitraryothervalue"
			consumable.arbitraryothervalue = 42;
			consumable.setFlavor('Flavor2');
			expect(consumable).to.not.have.property('arbitraryothervalue');
		});
	});

	it('should error when trying to get virtual properties without a set flavor', function() {
		// It should not error on non-virtual properties
		for (let prop in consumable)
			expect(consumable.get.bind(consumable, prop)).to.not.throw();
		
		// It should error on virtual properties if no flavor is set
		for (let prop of Consumable.EXPOSED_FLAVOR_PROPERTIES)
			expect(consumable.get.bind(consumable, prop)).to.throw();
		
		// After setting a flavor, it should no longer error on virtual properties,
		// if they were set on the consumable
		consumable.setFlavor('Flavor1');
		for (let prop of Object.keys(consumable))
			expect(consumable.get.bind(consumable, prop)).to.not.throw();
	});

	it('should refer exposed virtual properties to the set flavor, and get all others on itself', function() {
		consumable.setFlavor('Flavor1');
		for (let key in consumable) {
			expect(consumable.get(key), key).to.deep.equal(Consumable.EXPOSED_FLAVOR_PROPERTIES.includes(key) ?
				TEST_DATA.Flavor1[key] : 
				TEST_DATA[key]);
		}
		for (let key of ['type','nation','species'])
			expect(consumable.get(`typeinfo.${key}`)).to.equal(TEST_DATA.typeinfo[key]);
	});
});