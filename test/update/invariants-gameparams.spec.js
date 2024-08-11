import { 
	haveID, 
	haveIndex, 
	haveName, 
	haveNoLabel, 
	moduleComponentsResolveUnambiguously,
	gunsAreSimilar,
	weaponAmmosAreOrdered 
} from '../../src/update/invariants-gameparams.js';
import InvariantError from '../../src/update/infra/invarianterror.js';
import clone from 'lodash/cloneDeep.js';
import { readFileSync } from 'fs';


describe('invariants-gameparams', function() {	
	let TEST_DATA;
	let data;

	before(function() {
		TEST_DATA = JSON.parse(readFileSync('test/update/testdata/invariants.spec.json'));
	});

	beforeEach(function() {
		data = clone(TEST_DATA);
	});

	describe('.haveID', function() {
		it('should not error on data that has a numeric ID', function() {			
			expect(haveID.bind(null, data)).to.not.throw();
		});

		it('should throw an InvariantError if ID is not numeric', function() {
			data.id = 'string';
			expect(haveID.bind(null, data)).to.throw(InvariantError);
		});

		it('should throw an InvariantError if ID is not present at all', function() {
			delete data.id;
			expect(haveID.bind(null, data)).to.throw(InvariantError);
		});
	});

	describe('.haveIndex', function() {
		it('should not error on data that has a well-formed index', function() {
			expect(haveIndex.bind(null, data)).to.not.throw();
		});

		it('should throw an InvariantError if index does not conform to the regex', function() {
			data.index = 'ABCDEFG';
			expect(haveIndex.bind(null, data)).to.throw(InvariantError);
		});

		it('should throw an InvariantError if index is not present at all', function() {
			delete data.index;
			expect(haveIndex.bind(null, data)).to.throw(InvariantError);
		});
	});

	describe('.haveName', function() {
		it('should not error on data that has a well-formed name', function() {
			expect(haveName.bind(null, data)).to.not.throw();
		});

		it('should throw an InvariantError if name does not conform to the regex', function() {
			data.name = 'ABCDEFG';
			expect(haveName.bind(null, data)).to.throw(InvariantError);
		});

		it('should throw an InvariantError if name is not present at all', function() {
			let data = clone(TEST_DATA);
			delete data.name;
			expect(haveName.bind(null, data)).to.throw(InvariantError);
		});
	});

	describe('.haveNoLabel', function() {
		it('should error only if data has a property called label', function() {
			expect(haveNoLabel.bind(null, data)).to.not.throw();
			data.label = 'label';
			expect(haveNoLabel.bind(null, data)).to.throw(InvariantError);
		});
	});

	describe('.moduleComponentsResolveUnambiguously', function() {
		it('should not error if all modules\'s components have length 1', function() {
			expect(moduleComponentsResolveUnambiguously.bind(null, data)).to.not.throw();
		});

		it('should throw an InvariantError if there is a component definition of length > 1 without another one to remedy it', function() {
			data.ShipUpgradeInfo.A_Hull.components['torpedoes'] = [ 'AB1_Torpedoes', 'AB2_Torpedoes' ];
			expect(moduleComponentsResolveUnambiguously.bind(null, data)).to.throw();
		});

		it('should not error when there is a component with length > 1 but it is remedied by another', function() {
			// This will get remedied by the two Artillery module definitions:
			data.ShipUpgradeInfo.A_Hull.components['artillery'] = [ 'AB1_Artillery', 'AB2_Artillery' ];
			expect(moduleComponentsResolveUnambiguously.bind(null, data)).to.not.throw();
		});

		it('should not error when there is a component with length > 1 but it is remedied by several others', function() {
			let modules = data.ShipUpgradeInfo
			modules.A_Hull.components['artillery'] = [ 'AB1_Artillery', 'AB2_Artillery', 'AB3_Artillery' ];
			modules.AB2_Artillery.components['artillery'] = ['AB2_Artillery', 'AB3_Artillery']
			delete modules['AB1_Artillery'];
			modules.SUO_STOCK.components['artillery'] = [ 'AB1_Artillery', 'AB3_Artillery' ];
			// data now allows
			// on A_Hull: AB1_Artillery, AB2_Artillery, AB3_Artillery
			// on AB2_Artillery: AB2_Artillery, AB3_Artillery
			// AB1_Artillery has been removed
			// on SUO_STOCK: AB1_Artillery, AB3_Artillery
			// This is resolvable to AB3_Artillery by combining all three
			expect(moduleComponentsResolveUnambiguously.bind(null, data)).to.not.throw();
		});

		it('should ignore failed invariant checks for ships listed in moduleComponentsResolveUnambiguously.IGNORE', function() {
			data.ShipUpgradeInfo.A_Hull.components['torpedoes'] = [ 'AB1_Torpedoes', 'AB2_Torpedoes' ];
			let ignoreList = moduleComponentsResolveUnambiguously.IGNORE;
			moduleComponentsResolveUnambiguously.IGNORE = [ data.name ];
			
			try {
				expect(moduleComponentsResolveUnambiguously.bind(null, data)).to.not.throw();				
			} finally {
				moduleComponentsResolveUnambiguously.IGNORE = ignoreList;
			}
		});

		it('should throw an InvariantError when there is a component with length > 1, but the remedy requires two modules of the same type', function() {
			let modules = data.ShipUpgradeInfo;
			modules.A_Hull.components['artillery'] = [ 'AB1_Artillery', 'AB2_Artillery', 'AB3_Artillery' ];
			modules.AB1_Artillery.components['artillery'] = [ 'AB1_Artillery', 'AB3_Artillery' ];
			modules.AB2_Artillery.components['artillery'] = [ 'AB2_Artillery', 'AB3_Artillery' ];
			// data now allows
			// on A_Hull: AB1_Artillery, AB2_Artillery, AB3_Artillery
			// on AB1_Artillery: AB1_Artillery, AB3_Artillery
			// on AB2_Artillery: AB2_Artillery, AB3_Artillery
			// This is only resolvable by equipping AB1_Artillery and AB2_Artillery simultaneously,
			// which the algorithm should not allow
			expect(moduleComponentsResolveUnambiguously.bind(null, data)).to.throw();
		});
	});

	describe('.gunsAreSimilar', function() {		
		const GUN_PROPERTIES = [
			'minRadius',
			'idealRadius',
			'idealDistance',
			'radiusOnZero',
			'radiusOnDelim',
			'radiusOnMax',
			'delim'
		]

		let ship;

		beforeEach(function() {
			const NUMBER_OF_GUNS = 2;
			const NUMBER_OF_ARTILLERIES = 2;
			
			ship = { typeinfo: { type: 'Ship' } };
			for (let i = 1; i <= NUMBER_OF_ARTILLERIES; i++) {
				const artillery = {};
				ship[`AB${i}_Artillery`] = artillery;

				for (let j = 1; j <= NUMBER_OF_GUNS; j++) {
					artillery[`Gun${j}`] = Object.assign(
						{}, 
						Object.fromEntries(GUN_PROPERTIES.map((prop, index) => [ prop, index ])),
						{ typeinfo: { type: 'Gun', species: 'Main' } });
				}
			}
		});

		it('should not error when all required gun properties are equal within an artillery definition', function() {
			gunsAreSimilar(ship)
			expect(gunsAreSimilar.bind(null, ship)).to.not.throw();
		});

		it('should not error when required gun properties are not equal across artillery definitions', function() {
			ship.AB1_Artillery.Gun1.radiusOnZero = ship.AB1_Artillery.Gun2.radiusOnZero = -1;

			expect(gunsAreSimilar.bind(null, ship)).to.not.throw();
		});

		it('should error when required gun properties are not equal within an artillery definition', function() {
			ship.AB1_Artillery.Gun1.radiusOnZero = -1;

			expect(gunsAreSimilar.bind(null, ship)).to.throw();
		});
	});

	describe('.assertWeaponAmmosAreOrdered', function() {
		it('should not error when all weapons\' ammos are always in the same order', function() {
			expect(weaponAmmosAreOrdered.bind(null, data)).to.not.throw();
		});

		it('should throw an InvariantError when weapons\' ammos are in a different order for different guns', function() {
			// Make the ammo lists of the second gun the reverse of the first gun in AB1_Artillery
			// Should fail
			data.AB1_Artillery.HP_AGM_2.ammoList = clone(data.AB1_Artillery.HP_AGM_1.ammoList).reverse(); // Need to clone because reverse() works in-place			
			expect(weaponAmmosAreOrdered.bind(null, data)).to.throw();
		});

		it('should not throw if ammo order is different between different modules as long as it is consistent within the module', function() {
			// Make the ammo lists of all guns in AB2_Artillery be in reverse order from AB1_Artillery
			// Should pass, because the order is consistent within the modules
			data.AB2_Artillery.HP_AGM_1.ammoList = clone(data.AB1_Artillery.HP_AGM_1.ammoList).reverse(); // Need to clone because reverse() works in-place
			data.AB2_Artillery.HP_AGM_2.ammoList = clone(data.AB1_Artillery.HP_AGM_2.ammoList).reverse(); // Need to clone because reverse() works in-place
			expect(weaponAmmosAreOrdered.bind(null, data)).to.not.throw();			
		});
	});
});