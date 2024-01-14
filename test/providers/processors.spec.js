import * as processors from '../../src/providers/processors.js';
import GameObject from '../../src/model/gameobject.js';
import sinon from 'sinon';

describe('GameObjectSuppler Processors', function() {
	describe('expand', function() {
		const target = {
			id: 1,
			index: 'PAAA001',
			name: 'PAAA001_Test1',
			typeinfo: {
				type: 'Target'
			}
		};
		const referrer = {
			id: 2,
			index: 'PAAA002',
			name: 'PAAA002_Test2',
			reference: 'PAAA001_Test1',
			typeinfo: {
				type: 'Referrer'
			}
		};

		let expand;
		let supplier;
		beforeEach(function() {
			supplier = {
				get: sinon.stub()
			}
			expand = processors.expand.bind(null, supplier);
		});


		it('should expand references', async function() {
			supplier.get.resolves(target);

			const result = await expand(referrer.reference);

			expect(result).to.deep.equal(target)
		});

		it('should throw an error if a reference target could not be retrieved', async function() {
			supplier.get.rejects();

			const result = expand(referrer.reference);

			return expect(result).to.eventually.be.rejected;
		});

		it('should return undefined when a reference target is null', async function() {
			const result = await expand(referrer.reference);

			expect(result).to.be.undefined;
		});
	});

	describe('convert', function() {
		it('should convert to the correct class as per typeinfo.type', function() {
			const TYPE = 'Type';
			const CLASS = class {};
			const input = {
				typeinfo: { type: TYPE }
			}

			const result = processors.convert({
				[TYPE]: CLASS
			}, input);

			expect(result).to.be.an.instanceOf(CLASS);
		});

		it('should convert to the correct class as per typeinfo.type and typeinfo.species', function() {
			const TYPE = 'Type';
			const SPECIES = 'Species';
			const CLASS = class {};
			const input = {
				typeinfo: { type: TYPE, species: SPECIES }
			}

			const result = processors.convert({
				[TYPE]: { [SPECIES]: CLASS }
			}, input);

			expect(result).to.be.an.instanceOf(CLASS);
		});

		it('should convert to GameObject if there is typeinfo but the type is not known', function() {
			const input = {
				typeinfo: { type: 'UnknownType' }
			}

			const result = processors.convert({}, input);

			expect(result).to.be.an.instanceOf(GameObject);
		});

		it('should return the input unchanged if there is no typeinfo', function() {
			const input = {};

			const result = processors.convert({}, input);

			expect(result).to.equal(input);
		});

		it('should return the input unchanged if it is already a GameObject', function() {
			const input = new GameObject({});

			const result = processors.convert({}, input);

			expect(result).to.equal(input);
		});
	});

	describe('buildResearchTree', function() {
		const UPGRADE_INFO = {
			ART_STOCK: {
				canBuy: true,
				prev: '',
				ucType: '_Artillery'
			},
			ENG_TOP: {
				canBuy: true,
				prev: 'ENG_STOCK',
				ucType: '_Engine'
			},
			ENG_STOCK: {
				canBuy: true,
				prev: '',
				ucType: '_Engine'
			},
			HULL_STOCK: {
				canBuy: true,
				prev: '',
				ucType: '_Hull'
			},
			HULL_TOP: {
				canBuy: true,
				prev: 'HULL_STOCK',
				ucType: '_Hull'
			},
			SUO_STOCK: {
				canBuy: true,
				prev: '',
				ucType: '_Suo'
			},
			SUO_TOP: {
				canBuy: true,
				prev: 'SUO_MIDDLE',
				ucType: '_Suo'
			},
			SUO_MIDDLE: {
				canBuy: true,
				prev: 'SUO_STOCK',
				ucType: '_Suo'
			},
		}

		it('should start a new path for every module type', function() {
			let expected = UPGRADE_INFO;
			expect(processors.buildResearchTree(UPGRADE_INFO)).to
				.be.an('object')
				.that.has.all.keys(expected.ART_STOCK.ucType, expected.ENG_STOCK.ucType, expected.HULL_STOCK.ucType, expected.SUO_STOCK.ucType);
		});

		it('should assign modules to the correct module lines when every module\'s type is the same as its predecessor (simple case)', function() {
			let result = processors.buildResearchTree(UPGRADE_INFO);
			let expected = UPGRADE_INFO;
			for (let ucType of [expected.ART_STOCK.ucType, expected.HULL_STOCK.ucType, expected.ENG_STOCK.ucType, expected.SUO_STOCK.ucType]) {
				// Expect the ucTypes of all modules in the current module line
				// to be the same as that of the module line itself
				expect(result[ucType].every(o => o.ucType === ucType)).to.be.true;
			}			
		});

		it('should correctly order modules within the module lines when every module\'s type is the same as its predecessor (simple case)', function() {
			let expected = UPGRADE_INFO;
			let result = processors.buildResearchTree(UPGRADE_INFO);
			
			expect(result[expected.ART_STOCK.ucType]).to.have.ordered.deep.members([expected.ART_STOCK])
			expect(result[expected.HULL_STOCK.ucType]).to.have.ordered.deep.members([expected.HULL_STOCK, expected.HULL_TOP]);
			expect(result[expected.ENG_STOCK.ucType]).to.have.ordered.deep.members([expected.ENG_STOCK, expected.ENG_TOP]);
			expect(result[expected.SUO_STOCK.ucType]).to.have.ordered.deep.members([expected.SUO_STOCK, expected.SUO_MIDDLE, expected.SUO_TOP]);
		});

		it('should assign modules to the correct module lines in the correct order even when modules\' predecessors have a different type (complex case)', function() {
			const upgradeInfo = { ...UPGRADE_INFO, 
				SUO_MIDDLE: { 
					...UPGRADE_INFO.SUO_MIDDLE,
					// Make SUO_MIDDLE depend on HULL_TOP
					prev: 'HULL_TOP'
				}
			};

			let result = processors.buildResearchTree(upgradeInfo);

			expect(result[upgradeInfo.SUO_STOCK.ucType]).to
				.have.deep.ordered.members([upgradeInfo.SUO_STOCK, upgradeInfo.SUO_MIDDLE, upgradeInfo.SUO_TOP]);
		});
	});
});