import GameObjectProvider from '../../src/providers/gameobjectprovider.js';
import Consumable from '../../src/model/consumable.js';
import { readFileSync } from 'fs';
import mockfs from 'mock-fs';
import clone from 'clone';
import sinon from 'sinon';

describe('Ship @integration', function() {
	let TEST_DATA;
	let SHIP_DATA;
	let CONSUMABLE_DATA;
	let exposedFlavorProperties;

	let gameObjectProvider;
	let ship;

	const datadir = '/data';

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
		const files = {};
		for (let obj of Object.values(TEST_DATA)) {
			files[obj.name + '.json'] = JSON.stringify(obj);
			files[obj.index + '.json'] = JSON.stringify(obj);
			files[obj.id + '.json'] = JSON.stringify(obj);
		}
		mockfs({
			[datadir]: files
		});
	});

	afterEach(mockfs.restore);

	beforeEach(async function() {
		const mockLabeler = {
			label: x => x
		}
		gameObjectProvider = new GameObjectProvider(datadir, mockLabeler);
		ship = await gameObjectProvider.createGameObject(SHIP_DATA.name);
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