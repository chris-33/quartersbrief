var Ship = require('$/src/model/ship');
var GameObject = require('$/src/model/gameobject');
var TEST_DATA = require('$/test/model/ship.spec.json');

describe('Ship', function() {

	it('should be a GameObject', function() {
		expect(new Ship(TEST_DATA)).to.be.an.instanceof(GameObject);
	});

	describe('#getResearchPaths', function() {
		it('should start a new path for every component type', function() {
			var expected = TEST_DATA.ShipUpgradeInfo;
			expect(new Ship(TEST_DATA).getResearchPaths()).to
				.be.an('object')
				.that.has.all.keys(expected.PAUA821_B9_ART_STOCK.ucType, 
					expected.PAUE832_B9_ENG_STOCK.ucType,
					expected.PAUH831_Iowa_1943.ucType,
					expected.PAUS821_Suo.ucType);
		});

		it('should correctly assign upgrades to research paths', function() {
			var result = new Ship(TEST_DATA).getResearchPaths();
			var expected = TEST_DATA.ShipUpgradeInfo;
			for (let ucType of [expected.PAUA821_B9_ART_STOCK.ucType, 
							expected.PAUH831_Iowa_1943.ucType, 
							expected.PAUE832_B9_ENG_STOCK.ucType, 
							expected.PAUS821_Suo.ucType]) {
				// Expect the ucTypes of all upgrades in the current research path
				// to be the same as that of the research path itself
				expect(result[ucType].every(o => o.ucType === ucType)).to.be.true;
			}			
		});

		it('should correctly order upgrades within a research path', function() {
			var expected = TEST_DATA.ShipUpgradeInfo;
			var result = new Ship(TEST_DATA).getResearchPaths();
			
			expect(result[expected.PAUA821_B9_ART_STOCK.ucType]).to
				.have.ordered.members([expected.PAUA821_B9_ART_STOCK])
			expect(result[expected.PAUH831_Iowa_1943.ucType]).to
				.have.ordered.members([expected.PAUH831_Iowa_1943, expected.PAUH832_Iowa_1944]);
			expect(result[expected.PAUE832_B9_ENG_STOCK.ucType]).to
				.have.ordered.members([expected.PAUE832_B9_ENG_STOCK, expected.PAUE831_B9_ENG_TOP]);
			expect(result[expected.PAUS821_Suo.ucType]).to
				.have.ordered.members([expected.PAUS821_Suo, expected.PAUS822_Suo]);
		});
	});
});