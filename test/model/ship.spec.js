import { Ship } from '$/src/model/ship.js';
import { GameObject } from '$/src/model/gameobject.js';
import clone from 'just-clone';
import { readFileSync } from 'fs';

describe('Ship', function() {
	let TEST_DATA;

	before(function() {
		TEST_DATA = JSON.parse(readFileSync('test/model/ship.spec.json'));		
	});

	it('should be a GameObject', function() {		
		expect(new Ship(TEST_DATA)).to.be.an.instanceof(GameObject);

	});

	describe('.getModuleLines', function() {
		it('should start a new path for every module type', function() {
			let expected = TEST_DATA.ShipUpgradeInfo;
			expect(new Ship(TEST_DATA).getModuleLines()).to
				.be.an('object')
				.that.has.all.keys(expected.ART_STOCK.ucType, 
					expected.ENG_STOCK.ucType,
					expected.HULL_STOCK.ucType,
					expected.SUO_STOCK.ucType);
		});

		it('should assign modules to the correct module lines when every module\'s type is the same as its predecessor (simple case)', function() {
			let result = new Ship(TEST_DATA).getModuleLines();
			let expected = TEST_DATA.ShipUpgradeInfo;
			for (let ucType of [expected.ART_STOCK.ucType, 
							expected.HULL_STOCK.ucType, 
							expected.ENG_STOCK.ucType, 
							expected.SUO_STOCK.ucType]) {
				// Expect the ucTypes of all modules in the current module line
				// to be the same as that of the module line itself
				expect(result[ucType].every(o => o.ucType === ucType)).to.be.true;
			}			
		});

		it('should correctly order modules within the module lines  when every module\'s type is the same as its predecessor (simple case)', function() {
			let expected = TEST_DATA.ShipUpgradeInfo;
			let result = new Ship(TEST_DATA).getModuleLines();
			
			expect(result[expected.ART_STOCK.ucType]).to
				.have.ordered.deep.members([expected.ART_STOCK])
			expect(result[expected.HULL_STOCK.ucType]).to
				.have.ordered.deep.members([expected.HULL_STOCK, expected.HULL_TOP]);
			expect(result[expected.ENG_STOCK.ucType]).to
				.have.ordered.deep.members([expected.ENG_STOCK, expected.ENG_TOP]);
			expect(result[expected.SUO_STOCK.ucType]).to
				.have.ordered.deep.	members([expected.SUO_STOCK, expected.SUO_MIDDLE, expected.SUO_TOP]);
		});

		it('should assign modules to the correct module lines in the correct order even when modules\' predecessors have a different type (complex case)', function() {
			let data = clone(TEST_DATA);
			// Make SUO_MIDDLE depend on HULL_TOP
			data.ShipUpgradeInfo.SUO_MIDDLE.prev = 'HULL_TOP';
			let ship = new Ship(data);

			let expected = data.ShipUpgradeInfo;
			let result = ship.getModuleLines();

			expect(result[data.ShipUpgradeInfo.SUO_STOCK.ucType]).to
				.have.deep.ordered.members([expected.SUO_STOCK, expected.SUO_MIDDLE, expected.SUO_TOP]);
		});
	});

	describe('.applyConfiguration', function() {
		let ship;

		beforeEach(function() {
			ship = new Ship(TEST_DATA);
		});
		it('should have equipped the beginnings of the module lines after applying the stock configuration', function() {
			let expected = {
				artillery: TEST_DATA.AB1_Artillery,
				engine: TEST_DATA.AB1_Engine,
				airDefense: TEST_DATA.A_AirDefense,
				atba: TEST_DATA.AB_ATBA,
				directors: TEST_DATA.AB_Directors,
				finders: TEST_DATA.AB_Finders,
				hull: TEST_DATA.A_Hull,
				fireControl: TEST_DATA.AB1_FireControl
			};
			ship.applyConfiguration('stock');
			let result = ship.getCurrentConfiguration();

			for (let key in expected) 
				expect(result[key]).to.deep.equal(expected[key]);
		});

		it('should have equipped the ends of the module lines after applying the top configuration', function() {
			let expected = {
				artillery: TEST_DATA.AB1_Artillery,
				engine: TEST_DATA.AB2_Engine,
				airDefense: TEST_DATA.B_AirDefense,
				atba: TEST_DATA.AB_ATBA,
				directors: TEST_DATA.AB_Directors,
				finders: TEST_DATA.AB_Finders,
				hull: TEST_DATA.B_Hull,
				fireControl: TEST_DATA.AB3_FireControl
			};
			ship.applyConfiguration('top');
			let result = ship.getCurrentConfiguration();

			for (let key in expected) 
				expect(result[key]).to.deep.equal(expected[key]);
		});

		it('should throw a TypeEror if a complex configuration doesn\'t define all modules', function() {
			expect(ship.applyConfiguration.bind(ship, 'engine: stock')).to.throw(TypeError);
			expect(ship.applyConfiguration.bind(ship, '')).to.throw(TypeError);
			expect(ship.applyConfiguration.bind(ship, 'malformed')).to.throw(TypeError);
		});

		it('should have equipped the specified combination of modules after applying a more specific configuration', function() {
			let expected = {
				artillery: TEST_DATA.AB1_Artillery,
				engine: TEST_DATA.AB1_Engine,
				atba: TEST_DATA.AB_ATBA,
				directors: TEST_DATA.AB_Directors,
				finders: TEST_DATA.AB_Finders,
				hull: TEST_DATA.B_Hull,
				fireControl: TEST_DATA.AB2_FireControl
			};
			ship.applyConfiguration('engine: stock, suo: 1, others: top');
			let result = ship.getCurrentConfiguration();

			for (let key in expected) 
				expect(result[key]).to.deep.equal(expected[key]);
		})
	});
});