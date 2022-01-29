var Ship = require('$/src/model/ship');
var GameObject = require('$/src/model/gameobject');
var TEST_DATA = require('$/test/model/ship.spec.json');

describe('Ship', function() {

	it('should be a GameObject', function() {
		expect(new Ship(TEST_DATA)).to.be.an.instanceof(GameObject);
	});

	describe('.getResearchPaths', function() {
		it('should start a new path for every component type', function() {
			var expected = TEST_DATA.ShipUpgradeInfo;
			expect(new Ship(TEST_DATA).getResearchPaths()).to
				.be.an('object')
				.that.has.all.keys(expected.ART_STOCK.ucType, 
					expected.ENG_STOCK.ucType,
					expected.HULL_STOCK.ucType,
					expected.SUO_STOCK.ucType);
		});

		it('should correctly assign upgrades to research paths', function() {
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

		it('should correctly order upgrades within a research path', function() {
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
		it('should return the beginning of the research paths for the stock configuration', function() {
			var expected = TEST_DATA.ShipUpgradeInfo;
			var result = new Ship(TEST_DATA).getConfiguration('stock');

			expect(result[expected.ART_STOCK.ucType]).to
				.deep.equal(expected.ART_STOCK);
			expect(result[expected.HULL_STOCK.ucType]).to
				.deep.equal(expected.HULL_STOCK);
			expect(result[expected.ENG_STOCK.ucType]).to
				.deep.equal(expected.ENG_STOCK);
			expect(result[expected.SUO_STOCK.ucType]).to
				.deep.equal(expected.SUO_STOCK);
		});

		it('should return the end of the research paths for the top configuration', function() {
			var expected = TEST_DATA.ShipUpgradeInfo;
			var result = new Ship(TEST_DATA).getConfiguration('top');

			expect(result[expected.ART_STOCK.ucType]).to // ART has only one
				.deep.equal(expected.ART_STOCK);
			expect(result[expected.HULL_STOCK.ucType]).to
				.deep.equal(expected.HULL_TOP);
			expect(result[expected.ENG_STOCK.ucType]).to
				.deep.equal(expected.ENG_TOP);
			expect(result[expected.SUO_STOCK.ucType]).to
				.deep.equal(expected.SUO_TOP);
		});
	});
});