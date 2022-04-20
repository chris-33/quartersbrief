import { GameObjectFactory } from '../../src/model/gameobjectfactory.js';
import { Consumable } from '../../src/model/consumable.js';
import { readFileSync } from 'fs';
import clone from 'clone';
import sinon from 'sinon';

describe('Ship @integration', function() {
	let TEST_DATA;
	let SHIP_DATA;
	let CONSUMABLE_DATA;
	let exposedFlavorProperties;

	let gameObjectFactory;
	let ship;

	before(function() {
		SHIP_DATA = JSON.parse(readFileSync('test/model/testdata/ship.json'));
		CONSUMABLE_DATA = JSON.parse(readFileSync('test/model/testdata/consumable.json'));
		TEST_DATA = {
			[SHIP_DATA.name]: SHIP_DATA,
			...CONSUMABLE_DATA
		};
	});

	before(function() {
		exposedFlavorProperties = Consumable.EXPOSED_FLAVOR_PROPERTIES;
		Consumable.EXPOSED_FLAVOR_PROPERTIES = Object.keys(CONSUMABLE_DATA.PCY001_Consumable1.Flavor1);
	});

	after(function() {
		Consumable.EXPOSED_FLAVOR_PROPERTIES = exposedFlavorProperties;
	});

	beforeEach(function() {
		gameObjectFactory = new GameObjectFactory(clone(TEST_DATA));
		ship = gameObjectFactory.createGameObject(SHIP_DATA.name);
	});

	describe('constructor', function() {
		it('should set flavors for all consumables', function() {
			// The point of this test:
			// Even though consumables are lazily-expanding references, the constructor should set us up in
			// such a way that when they ARE accessed, they have a flavor set.
			let consumable = ship.get('ShipAbilities.AbilitySlot0.abils.0.0');

			expect(consumable.get('prop')).to.equal(CONSUMABLE_DATA.PCY001_Consumable1.Flavor1.prop);
		});

		it('should not expand consumable references', function() {
			// The point of this test:
			// Consumables are lazily-expanding references when Ship is instantiated. Make sure that
			// the constructor, when setting flavors, does this in a way that does not force them
			// to be expanded. (Otherwise, that would defeat the purpose of having them be lazily expanding
			// in the first place - and expanding consumables can be expensive, e.g. with the CallFighters
			// consumable.)

			// Change property descriptor so that we can spy on the getter:
			const desc = Object.getOwnPropertyDescriptor(ship._data.ShipAbilities.AbilitySlot0.abils[0], '0');
			// Make sure we actually got a lazy reference from createGameObject
			expect(desc, 'should be an accessor property').to.not.have.property('value');

			const spy = sinon.spy(desc.get);
			Object.defineProperty(ship._data.ShipAbilities.AbilitySlot0.abils[0], '0', {
				...desc,
				get: spy
			});
			expect(spy).to.not.have.been.called;			
		});

		it('should be a value property after expanding', function() {
			// The point of this test:
			// The Ship constructor needs to set flavors on all consumables, but at the same time should not
			// force them all to expand. The way it does this is by wrapping the lazy reference in another
			// getter, which assigns a flavor right after the reference has been expanded.
			// 
			// This test checks that this wrapper disappears together with the lazy expansion, and is afterwards
			// just a regular value property of the Consumable.
			// Manually create a lazily-expanding reference
			// It should be an accessor property now:
			expect(ship.get('ShipAbilities.AbilitySlot0.abils.0')).to
				.have.ownPropertyDescriptor('0')
				.that.has.property('get')
			// Force expansion
			ship.consumables;
			// It should be a value property now:
			expect(ship.get('ShipAbilities.AbilitySlot0.abils.0')).to
				.have.ownPropertyDescriptor('0')
				.that.has.property('value');
		});
	});

	describe('.consumables', function() {
		it('should be a hash of all consumables, with the consumableType as the key', function() {
			for (let consumableName in CONSUMABLE_DATA) {
				let consumable = CONSUMABLE_DATA[consumableName];
				const expected = new Consumable(consumable);
				expected.setFlavor('Flavor1');
				expect(ship.consumables, consumable.Flavor1.consumableType).to
					.have.property(consumable.Flavor1.consumableType)
					.that.deep.equals(expected);
			}
		});
	});

});