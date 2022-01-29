var Ship = require('$/src/model/ship');
var GameObject = require('$/src/model/gameobject');
var TEST_DATA = require('$/test/model/ship.spec.json');

describe('Ship', function() {

	it('should be a GameObject', function() {		
		expect(new Ship(TEST_DATA)).to.be.an.instanceof(GameObject);

	});

	describe('.getResearchPaths', function() {
		it('should start a new path for every upgrade type', function() {
			var expected = TEST_DATA.ShipUpgradeInfo;
			expect(new Ship(TEST_DATA).getResearchPaths()).to
				.be.an('object')
				.that.has.all.keys(expected.ART_STOCK.ucType, 
					expected.ENG_STOCK.ucType,
					expected.HULL_STOCK.ucType,
					expected.SUO_STOCK.ucType);
		});

		it('should assign upgrades to the correct research paths when every upgrade\'s type is the same as its predecessor (simple case)', function() {
			var result = new Ship(TEST_DATA).getResearchPaths();
			var expected = TEST_DATA.ShipUpgradeInfo;
			for (let ucType of [expected.ART_STOCK.ucType, 
							expected.HULL_STOCK.ucType, 
							expected.ENG_STOCK.ucType, 
							expected.SUO_STOCK.ucType]) {
				// Expect the ucTypes of all upgrades in the current research path
				// to be the same as that of the research path itself
				expect(result[ucType].every(o => o.ucType === ucType)).to.be.true;
			}			
		});

		it('should correctly order upgrades within the research paths  when every upgrade\'s type is the same as its predecessor (simple case)', function() {
			var expected = TEST_DATA.ShipUpgradeInfo;
			var result = new Ship(TEST_DATA).getResearchPaths();
			
			expect(result[expected.ART_STOCK.ucType]).to
				.have.ordered.deep.members([expected.ART_STOCK])
			expect(result[expected.HULL_STOCK.ucType]).to
				.have.ordered.deep.members([expected.HULL_STOCK, expected.HULL_TOP]);
			expect(result[expected.ENG_STOCK.ucType]).to
				.have.ordered.deep.members([expected.ENG_STOCK, expected.ENG_TOP]);
			expect(result[expected.SUO_STOCK.ucType]).to
				.have.ordered.deep.	members([expected.SUO_STOCK, expected.SUO_MIDDLE, expected.SUO_TOP]);
		});
	});

	describe('.getConfiguration', function() {
		var ship;

		beforeEach(function() {
			ship = new Ship(TEST_DATA);
		});
		it('should have equipped the beginnings of the research paths after applying the stock configuration', function() {
			var expected;
			with (TEST_DATA)
				expected = {
					artillery: AB1_Artillery,
					engine: AB1_Engine,
					airDefense: A_AirDefense,
					atba: AB_ATBA,
					directors: AB_Directors,
					finders: AB_Finders,
					hull: A_Hull,
					fireControl: AB1_FireControl
				};
			ship.applyConfiguration('stock');
			var result = ship.getCurrentConfiguration();

			for (key in expected) 
				expect(result[key]).to.deep.equal(expected[key]);
		});

		it('should have equipped the ends of the research paths after applying the top configuration', function() {
			var expected;
			with (TEST_DATA)
				expected = {
					artillery: AB1_Artillery,
					engine: AB2_Engine,
					airDefense: B_AirDefense,
					atba: AB_ATBA,
					directors: AB_Directors,
					finders: AB_Finders,
					hull: B_Hull,
					fireControl: AB3_FireControl
				};
			ship.applyConfiguration('top');
			var result = ship.getCurrentConfiguration();

			for (key in expected) 
				expect(result[key]).to.deep.equal(expected[key]);
		});
	});
});