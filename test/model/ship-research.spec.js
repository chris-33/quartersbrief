import { getModuleLines } from '../../src/model/ship-research.js';
import { readFileSync } from 'fs';
import clone from 'lodash/cloneDeep.js';

describe('.getModuleLines', function() {
	let TEST_DATA;

	before(function() {
		TEST_DATA = JSON.parse(readFileSync('test/model/testdata/ship.json'));		
	});

	it('should start a new path for every module type', function() {
		let expected = TEST_DATA.ShipUpgradeInfo;
		expect(getModuleLines(TEST_DATA.ShipUpgradeInfo)).to
			.be.an('object')
			.that.has.all.keys(expected.ART_STOCK.ucType, 
				expected.ENG_STOCK.ucType,
				expected.HULL_STOCK.ucType,
				expected.SUO_STOCK.ucType);
	});

	it('should assign modules to the correct module lines when every module\'s type is the same as its predecessor (simple case)', function() {
		let result = getModuleLines(TEST_DATA.ShipUpgradeInfo);
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

	it('should correctly order modules within the module lines when every module\'s type is the same as its predecessor (simple case)', function() {
		let expected = TEST_DATA.ShipUpgradeInfo;
		let result = getModuleLines(TEST_DATA.ShipUpgradeInfo);
		
		expect(result[expected.ART_STOCK.ucType]).to
			.have.ordered.deep.members([expected.ART_STOCK])
		expect(result[expected.HULL_STOCK.ucType]).to
			.have.ordered.deep.members([expected.HULL_STOCK, expected.HULL_TOP]);
		expect(result[expected.ENG_STOCK.ucType]).to
			.have.ordered.deep.members([expected.ENG_STOCK, expected.ENG_TOP]);
		expect(result[expected.SUO_STOCK.ucType]).to
			.have.ordered.deep.members([expected.SUO_STOCK, expected.SUO_MIDDLE, expected.SUO_TOP]);
	});

	it('should assign modules to the correct module lines in the correct order even when modules\' predecessors have a different type (complex case)', function() {
		let data = clone(TEST_DATA);
		// Make SUO_MIDDLE depend on HULL_TOP
		data.ShipUpgradeInfo.SUO_MIDDLE.prev = 'HULL_TOP';

		let expected = data.ShipUpgradeInfo;
		let result = getModuleLines(data.ShipUpgradeInfo);

		expect(result[data.ShipUpgradeInfo.SUO_STOCK.ucType]).to
			.have.deep.ordered.members([expected.SUO_STOCK, expected.SUO_MIDDLE, expected.SUO_TOP]);
	});
});