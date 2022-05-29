import { Ship } from '../../src/model/ship.js';
import { Modernization } from '../../src/model/modernization.js';
import { Captain } from '../../src/model/captain.js';
import { Camouflage } from '../../src/model/camouflage.js';
import { Consumable } from '../../src/model/consumable.js';
import { Modifier } from '../../src/model/modifier.js';
import sinon from 'sinon';
import clone from 'clone';
import { readFileSync } from 'fs';
import createModule from '../../src/model/module.js';

describe('Ship', function() {
	let TEST_DATA;
	let CONSUMABLE_DATA;
	let knownTargets;
	let classSkills;
	let exposedFlavorProperties;

	let ship;

	before(function() {
		knownTargets = Modifier.KNOWN_TARGETS;
		Modifier.KNOWN_TARGETS = { EngineValue: 'engine.value', ArtilleryValue: 'artillery.value' }
		classSkills = Captain.CLASS_SKILLS;
		Captain.CLASS_SKILLS = { Cruiser: [3], Battleship: [1,2]};
		exposedFlavorProperties = Consumable.EXPOSED_FLAVOR_PROPERTIES;
		Consumable.EXPOSED_FLAVOR_PROPERTIES = [ 'consumableType', 'prop', 'value' ];
	});

	before(function() {
		TEST_DATA = JSON.parse(readFileSync('test/model/testdata/ship.json'));		
		CONSUMABLE_DATA = JSON.parse(readFileSync('test/model/testdata/consumable.json'));
	});

	beforeEach(function() {
		let data = clone(TEST_DATA);
		data.ShipAbilities.AbilitySlot0.abils[0][0] = new Consumable(clone(CONSUMABLE_DATA.PCY001_Consumable1));
		data.ShipAbilities.AbilitySlot0.abils[1][0] = new Consumable(clone(CONSUMABLE_DATA.PCY002_Consumable2));
		data.ShipAbilities.AbilitySlot1.abils[0][0] = new Consumable(clone(CONSUMABLE_DATA.PCY003_Consumable3));
		ship = new Ship(data);
	});

	after(function() {
		Modifier.KNOWN_TARGETS = knownTargets;
		Captain.CLASS_SKILLS = classSkills;
		Consumable.EXPOSED_FLAVOR_PROPERTIES = exposedFlavorProperties;
	});

	describe('constructor', function() {
		let data;
		let CONSUMABLE_DATA;

		before(function() {
			CONSUMABLE_DATA = JSON.parse(readFileSync('test/model/testdata/consumable.json'));
		});

		beforeEach(function() {
			data = clone(TEST_DATA);
			data.ShipAbilities.AbilitySlot0.abils[0][0] = CONSUMABLE_DATA.PCY001_Consumable1;
			data.ShipAbilities.AbilitySlot0.abils[1][0] = CONSUMABLE_DATA.PCY002_Consumable2;
			data.ShipAbilities.AbilitySlot1.abils[0][0] = CONSUMABLE_DATA.PCY003_Consumable3;
		});

		it('should set flavors for all consumables', function() {
			// The point of this test:
			// Even though consumables are lazily-expanding references, the constructor should set us up in
			// such a way that when they ARE accessed, they have a flavor set.


			// Manually create a lazily-expanding reference
			const val = clone(CONSUMABLE_DATA.PCY001_Consumable1);
			Object.defineProperty(data.ShipAbilities.AbilitySlot0.abils[0], '0', {
				get: function() {
					let consumable = new Consumable(val); 
					Object.defineProperty(data.ShipAbilities.AbilitySlot0.abils[0], '0', {
						value: consumable, enumerable: true
					});
					return consumable;
				},
				enumerable: true,
				configurable: true
			});
			let ship = new Ship(data);
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


			// Manually create a lazily-expanding reference
			const val = clone(CONSUMABLE_DATA.PCY001_Consumable1);
			const spy = sinon.spy(function() { return new Consumable(val); })
			Object.defineProperty(data.ShipAbilities.AbilitySlot0.abils[0], '0', {
				get: spy,
				enumerable: true,
				configurable: true
			});
			new Ship(data);
			expect(spy).to.not.have.been.called;			
		});
	});

	describe('.getModuleLines', function() {
		it('should start a new path for every module type', function() {
			let expected = TEST_DATA.ShipUpgradeInfo;
			expect(ship.getModuleLines()).to
				.be.an('object')
				.that.has.all.keys(expected.ART_STOCK.ucType, 
					expected.ENG_STOCK.ucType,
					expected.HULL_STOCK.ucType,
					expected.SUO_STOCK.ucType);
		});

		it('should assign modules to the correct module lines when every module\'s type is the same as its predecessor (simple case)', function() {
			let result = ship.getModuleLines();
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
			let result = ship.getModuleLines();
			
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

	describe('.equipModules', function() {
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
			for (let key in expected) 
				expected[key] = createModule(key, ship, expected[key]);

			ship.equipModules('stock');
			let result = ship;

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
			for (let key in expected) 
				expected[key] = createModule(key, ship, expected[key]);

			ship.equipModules('top');
			let result = ship;

			for (let key in expected) 
				expect(result[key]).to.deep.equal(expected[key]);
		});

		it('should throw a TypeEror if a complex configuration doesn\'t define all modules', function() {
			expect(ship.equipModules.bind(ship, 'engine: stock')).to.throw(TypeError);
			expect(ship.equipModules.bind(ship, '')).to.throw(TypeError);
			expect(ship.equipModules.bind(ship, 'malformed')).to.throw(TypeError);
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
			for (let key in expected) 
				expected[key] = createModule(key, ship, expected[key]);

			ship.equipModules('engine: stock, suo: 1, others: top');
			let result = ship;

			for (let key in expected) 
				expect(result[key]).to.deep.equal(expected[key]);
		});

		it('should have equipped the correct subclasses of Module for each component', function() {
			ship.equipModules('top');
			[ 'artillery', 'engine', 'atba', 'directors', 'finders', 'hull', 'fireControl' ].forEach(component => 
				expect(ship[component], component).to.be.an.instanceof(createModule(component).constructor));
		});

		it('should re-equip modernizations after changing module configuration', function() {
			ship.equipModules('stock');
			let modernization = new Modernization(JSON.parse(readFileSync('test/model/testdata/modernization.json')));
			try {
				sinon.stub(modernization, 'eligible').returns(true);

				ship.equipModernization(modernization);
				expect(ship.get('engine.value')).to.equal(modernization.get('modifiers').EngineValue * TEST_DATA.AB1_Engine.value);
				ship.equipModules('top');
				expect(ship.get('engine.value')).to.equal(modernization.get('modifiers').EngineValue * TEST_DATA.AB2_Engine.value);
			} finally {
				modernization.eligible.restore();
			}
		});

		it('should re-apply captain skills after changing module configuration', function() {
			ship.equipModules('stock');
			let captain = new Captain(JSON.parse(readFileSync('test/model/testdata/captain.json')));
			captain.learn(captain.get('Skills.BattleshipSkill1.skillType'));
			ship.setCaptain(captain);
			expect(ship.get('engine.value')).to.equal(captain.get('Skills.BattleshipSkill1.modifiers.EngineValue') * TEST_DATA.AB1_Engine.value);
			ship.equipModules('top');
			expect(ship.get('engine.value')).to.equal(captain.get('Skills.BattleshipSkill1.modifiers.EngineValue') * TEST_DATA.AB2_Engine.value);
		});

		it('should re-apply camouflage effects after changing module configuration', function() {
			ship.equipModules('stock');
			let camouflage = new Camouflage(JSON.parse(readFileSync('test/model/testdata/camouflage.json')));
			ship.setCamouflage(camouflage);
			expect(ship.get('engine.value')).to.equal(camouflage.get('modifiers.EngineValue') * TEST_DATA.AB1_Engine.value);
			ship.equipModules('top');
			expect(ship.get('engine.value')).to.equal(camouflage.get('modifiers.EngineValue') * TEST_DATA.AB2_Engine.value);
		});
	});

	describe('.equipModernization', function() {
		let modernization;
		beforeEach(function() {
			modernization = new Modernization(JSON.parse(readFileSync('test/model/testdata/modernization.json')));
			sinon.stub(modernization, 'eligible').returns(true);
		});

		afterEach(function() {
			modernization.eligible.restore();
		});

		it('should throw if trying to equip something that is not a Modernization', function() {
			expect(ship.equipModernization.bind(ship, {})).to.throw();
		});

		it('should return true if the modernization was equipped, false otherwise', function() {
			expect(ship.equipModernization(modernization)).to.be.true;
			// Should not mount more than once
			expect(ship.equipModernization(modernization)).to.be.false;
			modernization.eligible.returns(false);
			expect(ship.equipModernization(modernization)).to.be.false;
		});

		it('should apply the modernization effects', function() {
			ship.equipModernization(modernization);
			let modifiers = modernization.get('modifiers');
			// @todo This will need to be changed when a more sane readthrough of ship's properties has been implemented and getCurrentConfiguration() is removed
			expect(ship.get('artillery.value')).to.equal(TEST_DATA.AB1_Artillery.value * modifiers.ArtilleryValue);
		});

		it('should not apply the same modernization more than once', function() {
			ship.equipModernization(modernization);
			let val = ship.get('artillery.value');
			ship.equipModernization(modernization);
			expect(ship.get('artillery.value')).to.equal(val);
		});
	});

	describe('.unequipModernization', function() {
		let modernization;
	
		beforeEach(function() {
			modernization = new Modernization(JSON.parse(readFileSync('test/model/testdata/modernization.json')));
			sinon.stub(modernization, 'eligible').returns(true);
			ship.equipModernization(modernization);
		});

		afterEach(function() {
			modernization.eligible.restore();
		});

		it('should throw if trying to unequip something that is not a Modernization', function() {
			expect(ship.unequipModernization.bind(ship, {})).to.throw();
		});

		it('should return true if the modernization was previously equipped, false otherwise', function() {
			expect(ship.unequipModernization(modernization)).to.be.true;
			expect(ship.unequipModernization(modernization)).to.be.false;
		});

		it('should negate the modernization effects', function() {
			ship.unequipModernization(modernization);
			// @todo This will need to be changed when a more sane readthrough of ship's properties has been implemented and getCurrentConfiguration() is removed
			expect(ship.get('artillery.value')).to.equal(TEST_DATA.AB1_Artillery.value);
		});
	});

	describe('.setCaptain', function() {
		let CAPTAIN_DATA;
		let captain;
	
		before(function() {
			CAPTAIN_DATA = JSON.parse(readFileSync('test/model/testdata/captain.json'));
		});

		beforeEach(function() {
			captain = new Captain(CAPTAIN_DATA);
		});

		it('should throw if trying to set something that is not a Captain', function() {
			expect(ship.setCaptain.bind(ship, {})).to.throw();
			expect(ship.setCaptain.bind(ship, captain)).to.not.throw();
		});

		it('should apply the effects of the captain\'s learned skills', function() {
			let skills = captain.getLearnableForShip(ship);
			captain.learn(skills);

			ship.equipModules('stock');
			ship.setCaptain(captain);
			// @todo This will need to be changed when a more sane readthrough of ship's properties has been implemented and getCurrentConfiguration() is removed
			expect(ship.get('engine.value')).to.equal(TEST_DATA.AB1_Engine.value * captain.get('Skills.BattleshipSkill1.modifiers.EngineValue'));
			expect(ship.get('artillery.value')).to.equal(TEST_DATA.AB1_Artillery.value * captain.get('Skills.BattleshipSkill2.modifiers.ArtilleryValue'));
		});

		it('should revert the effects learned skills of any captain previously in command', function() {
			let captain1 = new Captain(CAPTAIN_DATA);
			let captain2 = new Captain(CAPTAIN_DATA);
			captain1.learn(1);
			captain2.learn(2);

			let engineValue = ship.get('engine.value');
			ship.setCaptain(captain1);
			ship.setCaptain(captain2);
			expect(ship.get('engine.value')).to.equal(engineValue);
		});

		it('should remove a previously set camouflage when setting to null', function() {
			let engineValue = ship.get('engine.value');
			ship.setCaptain(captain);
			ship.setCaptain(null);
			expect(ship.get('engine.value')).to.equal(engineValue);
		});

	});

	describe('.setCamouflage', function() {
		let CAMOUFLAGE_DATA;
		let camouflage;
	
		before(function() {
			CAMOUFLAGE_DATA = JSON.parse(readFileSync('test/model/testdata/camouflage.json'));
		});

		beforeEach(function() {
			camouflage = new Camouflage(CAMOUFLAGE_DATA);
		});

		it('should throw if trying to set something that is not a Camouflage', function() {
			expect(ship.setCamouflage.bind(ship, {})).to.throw();
			expect(ship.setCamouflage.bind(ship, camouflage)).to.not.throw();
		});

		it('should return true if the camouflage was set, false otherwise', function() {
			let eligible = sinon.stub(camouflage, 'eligible').returns(true);
			try {
				expect(ship.setCamouflage(camouflage)).to.be.true;
				eligible.returns(false);
				expect(ship.setCamouflage(camouflage)).to.be.false;
			} finally { eligible.restore(); }
		});

		it('should revert the effects of any previously set camouflage', function() {
			let camouflage1 = new Camouflage(CAMOUFLAGE_DATA);
			sinon.stub(camouflage1, 'getModifiers').returns([ new Modifier('engine.value', 2) ]);
			let camouflage2 = new Camouflage(camouflage);
			sinon.stub(camouflage2, 'getModifiers').returns([ new Modifier('artillery.value', 3) ]);

			let engineValue = ship.get('engine.value');
			expect(ship.setCamouflage(camouflage1)).to.be.true;
			expect(ship.setCamouflage(camouflage2)).to.be.true;
			expect(ship.get('engine.value')).to.equal(engineValue);
		});

		it('should revert the effects of a previously set camouflage when setting to null', function() {
			let engineValue = ship.get('engine.value');
			ship.setCamouflage(camouflage);
			ship.setCamouflage(null);
			expect(ship.get('engine.value')).to.equal(engineValue);
		});

		it('should apply the effects of the camouflage', function() {
			ship.equipModules('stock');
			ship.setCamouflage(camouflage);
			// @todo This will need to be changed when a more sane readthrough of ship's properties has been implemented and getCurrentConfiguration() is removed
			expect(ship.get('engine.value')).to.equal(TEST_DATA.AB1_Engine.value * camouflage.get('modifiers.EngineValue'));
			expect(ship.get('artillery.value')).to.equal(TEST_DATA.AB1_Artillery.value * camouflage.get('modifiers.ArtilleryValue'));
		});
	});

	describe('.consumables', function() {
		it('should be a hash of all consumables, with the consumableType as the key', function() {
			// Generator function that yields all the ships consumables one by one
			function* abilities() {
				const abils = Object.values(ship.get('ShipAbilities'))
					.flatMap(abilityslot => abilityslot.abils)
					.map(ability => ability[0]);
				let i = 0;
				while (i < abils.length)
					yield abils[i++];
				return;
			}

			expect(ship).to.have.property('consumables');
			expect(ship.consumables).to.be.an('object');

			for (let consumable of abilities()) {
				expect(ship.consumables, consumable.consumableType).to
					.have.property(consumable.consumableType)
					.that.deep.equals(consumable);
			}
		});

		describe('.slotOf', function() {
			it('should exist and be a function', function() {
				expect(ship.consumables.slotOf).to.exist.and.be.a('function');
			});

			it('should return -1 for a consumable the ship does not have', function() {
				expect(ship.consumables.slotOf('unknown_consumable_type'), 'with consumable type').to.equal(-1);
				let consumable = new Consumable({ 
					flavor: { consumableType: 'unknown_consumable_type' }
				});
				consumable.setFlavor('flavor');
				expect(ship.consumables.slotOf(consumable), 'with consumable object').to.equal(-1);
			});

			it('should return the slot of the consumable', function() {
				expect(ship.consumables.slotOf('consumable1'), 'with consumable type').to.equal(0);
				let consumable = ship.consumables.consumable1;
				expect(ship.consumables.slotOf(consumable), 'with consumable object').to.equal(0);
			});
		});
	});

	describe('.multiply', function() {
		it('should multiply into modules', function() {
			const coeff = 2;
			let val = ship.engine.get('value');
			ship.multiply('engine.value', coeff);
			expect(ship.engine.get('value')).to.equal(val * coeff);
		});

		it('should multiply into consumables', function() {
			const coeff = 2;
			ship.multiply('consumables.consumable1.value', coeff);

			expect(ship.consumables.consumable1.value).to.equal(CONSUMABLE_DATA.PCY001_Consumable1.Flavor1.value * coeff);
		});
	});
});