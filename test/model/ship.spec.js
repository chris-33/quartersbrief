import Ship from '../../src/model/ship.js';
import Modernization from '../../src/model/modernization.js';
import Captain from '../../src/model/captain.js';
import Camouflage from '../../src/model/camouflage.js';
import Consumable from '../../src/model/consumable.js';
import Signal from '../../src/model/signal.js';
import Modifier from '../../src/model/modifier.js';
import Module from '../../src/model/modules/module.js';
import sinon from 'sinon';
import clone from 'lodash/cloneDeep.js';
import { readFileSync } from 'fs';
import createModule from '../../src/model/create-module.js';
import groupBy from 'lodash/groupBy.js';

describe('Ship', function() {
	const EXPOSED_PROPERTY_DESCRIPTOR = {
		get: function() { return this._data.value },
		set: function(value) { this._data.value = value },
		enumerable: true,
		configurable: true
	}
	let TEST_DATA;
	let CONSUMABLE_DATA;
	let knownTargets;
	let classSkills;

	let ship;

	before(function() {
		knownTargets = Modifier.KNOWN_TARGETS;
		Modifier.KNOWN_TARGETS = { 
			EngineValue: 'refits.*.*.components.engine.*.value', 
			ArtilleryValue: 'refits.*.*.components.artillery.*.value' 
		}
		
		classSkills = Captain.CLASS_SKILLS;
		Captain.CLASS_SKILLS = { Cruiser: [3], Battleship: [1,2]};

		Object.defineProperty(Module.prototype, 'value', EXPOSED_PROPERTY_DESCRIPTOR);
	});

	before(function() {
		TEST_DATA = JSON.parse(readFileSync('test/model/testdata/ship.json'));		
		CONSUMABLE_DATA = JSON.parse(readFileSync('test/model/testdata/consumable.json'));
	});

	beforeEach(function() {
		let data = clone(TEST_DATA);
		for (let key in data) {
			// All module definitions conveniently start with A or B
			if (key.startsWith('A') || key.startsWith('B')) {
				const kind = key.slice(key.indexOf('_') + 1).toLowerCase();
				data[key] = createModule(kind, data[key]);
			}
		}

		for (let abilityDef of [ data.ShipAbilities.AbilitySlot0.abils[0], data.ShipAbilities.AbilitySlot0.abils[1], data.ShipAbilities.AbilitySlot1.abils[0] ]) {
			const ability = clone(CONSUMABLE_DATA[abilityDef[0]]);
			const flavor = abilityDef[1];
			Object.assign(ability, ability[flavor]);
			abilityDef[0] = new Consumable(ability);
			Object.defineProperty(abilityDef[0], 'value', EXPOSED_PROPERTY_DESCRIPTOR)
		}
		data.ShipAbilities.AbilitySlot0.abils[0] = data.ShipAbilities.AbilitySlot0.abils[0][0];
		data.ShipAbilities.AbilitySlot0.abils[1] = data.ShipAbilities.AbilitySlot0.abils[1][0];
		data.ShipAbilities.AbilitySlot1.abils[0] = data.ShipAbilities.AbilitySlot1.abils[0][0];

		data.ShipUpgradeInfo = groupBy(Object.values(data.ShipUpgradeInfo)
			.filter(research => research.ucType)
			.map(research => ({ ...research, ucType: research.ucType[1].toLowerCase() + research.ucType.slice(2) }))
			.sort((research1, research2) => {
				// Sort according to last letter of 'prev' property, leveraging that it can only be
				// '', 'STOCK' or 'MIDDLE' with this test data
				const lastLetter = [ undefined, 'K', 'E' ]
				return lastLetter.indexOf(research1.prev.at(-1)) - lastLetter.indexOf(research2.prev.at(-1));
			})
			.map(research => ({
				...research, components: Object.fromEntries(Object.entries(research.components)
						.map(([kind, components]) => [ kind, components.map(componentName => data[componentName]) ]))
			})), 'ucType');

		ship = new Ship(data);		
	});

	after(function() {
		Modifier.KNOWN_TARGETS = knownTargets;
		Captain.CLASS_SKILLS = classSkills;

		delete Module.prototype.value;
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

			ship.equipModules('stock');

			for (let key in expected) 
				expect(ship[key]._data).to.deep.equal(expected[key]);
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

			ship.equipModules('top');

			for (let key in expected) 
				expect(ship[key]._data).to.deep.equal(expected[key]);
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

			ship.equipModules('engine: stock, suo: 1, others: top');

			for (let key in expected) 
				expect(ship[key]._data).to.deep.equal(expected[key]);
		});

		it('should have equipped the correct subclasses of Module for each component', function() {
			ship.equipModules('top');
			[ 'artillery', 'engine', 'atba', 'directors', 'finders', 'hull', 'fireControl' ].forEach(component => 
				expect(ship[component], component).to.be.an.instanceof(createModule(component).constructor));
		});

		it('should re-equip modernizations after changing module configuration', function() {
			const MODIFIERS = {
				EngineValue: 2
			}
			let modernization = new Modernization({
				modifiers: MODIFIERS
			});
			sinon.stub(modernization, 'eligible').returns(true);

			ship.equipModules('stock');
			ship.equipModernization(modernization);
			expect(ship.engine.value).to.equal(MODIFIERS.EngineValue * TEST_DATA.AB1_Engine.value);
			
			ship.equipModules('top');
			expect(ship.engine.value).to.equal(MODIFIERS.EngineValue * TEST_DATA.AB2_Engine.value);
		});

		it('should re-apply captain skills after changing module configuration', function() {
			ship.equipModules('stock');
			const SKILLS = {
				Skill1: {
					skillType: 1,
					modifiers: {
						EngineValue: 2
					}
				},
				Skill2: {
					skillType: 2,
					modifiers: {
						ArtilleryValue: 3
					}
				}
			}
			let captain = new Captain({ Skills: SKILLS });
			captain.learn(SKILLS.Skill1.skillType);
			
			ship.setCaptain(captain);
			expect(ship.engine.value).to.equal(SKILLS.Skill1.modifiers.EngineValue * TEST_DATA.AB1_Engine.value);

			ship.equipModules('top');
			expect(ship.engine.value).to.equal(SKILLS.Skill1.modifiers.EngineValue * TEST_DATA.AB2_Engine.value);
		});

		it('should re-apply camouflage effects after changing module configuration', function() {
			const MODIFIERS = {
				EngineValue: 2
			}
			let camouflage = new Camouflage({ modifiers: MODIFIERS });
			sinon.stub(camouflage, 'isPermoflage').returns(true);
			
			ship.equipModules('stock');
			ship.setCamouflage(camouflage);
			
			expect(ship.engine.value).to.equal(MODIFIERS.EngineValue * TEST_DATA.AB1_Engine.value);
			ship.equipModules('top');
			expect(ship.engine.value).to.equal(MODIFIERS.EngineValue * TEST_DATA.AB2_Engine.value);
		});

		it('should re-hoist signals after changing module configuration', function() {
			const MODIFIERS = {
				EngineValue: 2
			}
			let signal = new Signal({ modifiers: MODIFIERS });
			
			ship.equipModules('stock');
			ship.hoist(signal);
			expect(ship.engine.value).to.equal(MODIFIERS.EngineValue * TEST_DATA.AB1_Engine.value);
			ship.equipModules('top');
			expect(ship.engine.value).to.equal(MODIFIERS.EngineValue * TEST_DATA.AB2_Engine.value);			
		});
	});

	describe('.equipModernization', function() {
		let modernization;		
		const MODIFIERS = {
			EngineValue: 2,
			ArtilleryValue: 3
		}
		beforeEach(function() {
			modernization = new Modernization({	"excludes": [],
				modifiers: MODIFIERS,
			});//JSON.parse(readFileSync('test/model/testdata/modernization.json')));
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

			[ 'Artillery', 'Engine' ].forEach(type => {
				Object.keys(ship._data)
					.filter(key => key.endsWith(`_${type}`))
					.forEach(target => 
						expect(ship._data[target].value).to.equal(TEST_DATA[target].value * MODIFIERS[`${type}Value`]));
			});
		});

		it('should not apply the same modernization more than once', function() {
			ship.equipModernization(modernization);
			const val = ship.artillery.value;

			ship.equipModernization(modernization);
			
			expect(ship.artillery.value).to.equal(val);
		});
	});

	describe('.unequipModernization', function() {
		const MODIFIERS = {
			EngineValue: 2,
			ArtilleryValue: 3
		}
		let modernization;
	
		beforeEach(function() {
			modernization = new Modernization({ modifiers: MODIFIERS });
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

			[ 'Artillery', 'Engine' ].forEach(type => {
				Object.keys(ship._data)
					.filter(key => key.endsWith(`_${type}`))
					.forEach(target => 
						expect(ship._data[target].value).to.equal(TEST_DATA[target].value));
			});
		});
	});

	describe('.setCaptain', function() {		
		const MODIFIERS = {
			EngineValue: 2,
			ArtilleryValue: 3
		}
		const SKILLS = {
			Skill1: {
				skillType: 1,
				// eslint-disable-next-line mocha/no-setup-in-describe
				modifiers: { EngineValue: MODIFIERS.EngineValue }
			},
			Skill2: {
				skillType: 2,
				// eslint-disable-next-line mocha/no-setup-in-describe
				modifiers: { ArtilleryValue: MODIFIERS.ArtilleryValue }
			}
		}
		let captain;
	
		beforeEach(function() {
			captain = new Captain({
				Skills: SKILLS
			});
		});

		it('should throw if trying to set something that is not a Captain', function() {
			expect(ship.setCaptain.bind(ship, {})).to.throw();
			expect(ship.setCaptain.bind(ship, captain)).to.not.throw();
		});

		it('should apply the effects of the captain\'s learned skills', function() {
			captain.learn(captain.skills);

			ship.setCaptain(captain);

			[ 'Artillery', 'Engine' ].forEach(type => {
				Object.keys(ship._data)
					.filter(key => key.endsWith(`_${type}`))
					.forEach(target => 
						expect(ship._data[target].value).to.equal(TEST_DATA[target].value * MODIFIERS[`${type}Value`]));
			});
		});

		it('should revert the effects learned skills of any captain previously in command', function() {
			let captain1 = new Captain({ Skills: SKILLS });
			let captain2 = new Captain({ Skills: SKILLS });
			captain1.learn(1);
			captain2.learn(2);

			ship.setCaptain(captain1);
			ship.setCaptain(captain2);

			Object.keys(ship._data)
				.filter(key => key.endsWith(`_Engine`))
				.forEach(target => 
					expect(ship._data[target].value).to.equal(TEST_DATA[target].value));
		});

		it('should remove a previously set captain when setting to null', function() {
			ship.setCaptain(captain);
			ship.setCaptain(null);

			[ 'Artillery', 'Engine' ].forEach(type => {
				Object.keys(ship._data)
					.filter(key => key.endsWith(`_${type}`))
					.forEach(target => 
						expect(ship._data[target].value).to.equal(TEST_DATA[target].value));
			});
		});

	});

	describe('.setCamouflage', function() {
		const MODIFIERS = {
			EngineValue: 2,
			ArtilleryValue: 3
		}

		let camouflage;
	
		beforeEach(function() {
			camouflage = new Camouflage({ 
				modifiers: MODIFIERS,				
			});			
			sinon.stub(camouflage, 'isPermoflage').returns(false);
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
			let camouflage1 = new Camouflage({ modifiers: { 
				EngineValue: MODIFIERS.EngineValue
			}});
			sinon.stub(camouflage1, 'isPermoflage').returns(true);			
			let camouflage2 = new Camouflage({ modifiers: {
				ArtilleryValue: MODIFIERS.ArtilleryValue
			}});
			sinon.stub(camouflage2, 'isPermoflage').returns(true);

			let engineValue = ship.engine.value;
			expect(ship.setCamouflage(camouflage1)).to.be.true;
			expect(ship.setCamouflage(camouflage2)).to.be.true;
			expect(ship.engine.value).to.equal(engineValue);
		});

		it('should revert the effects of a previously set camouflage when setting to null', function() {
			let engineValue = ship.engine.value;
			ship.setCamouflage(camouflage);
			ship.setCamouflage(null);
			expect(ship.engine.value).to.equal(engineValue);
		});

		it('should apply the effects of the camouflage', function() {
			ship.setCamouflage(camouflage);
			expect(ship.engine.value).to.equal(TEST_DATA.AB1_Engine.value * MODIFIERS.EngineValue);
			expect(ship.artillery.value).to.equal(TEST_DATA.AB1_Artillery.value * MODIFIERS.ArtilleryValue);
		});
	});

	describe('.hoist', function() {
		const MODIFIERS = {
			EngineValue: 2,
			ArtilleryValue: 3
		}
		let signal;
	
		beforeEach(function() {
			signal = new Signal({
				modifiers: MODIFIERS
			});
		});

		it('should throw if trying to set something that is not a Signal', function() {
			expect(ship.hoist.bind(ship, {})).to.throw();
			expect(ship.hoist.bind(ship, signal)).to.not.throw();
		});

		it('should apply the effects of the signal', function() {
			ship.hoist(signal);

			[ 'Artillery', 'Engine' ].forEach(type => {
				Object.keys(ship._data)
					.filter(key => key.endsWith(`_${type}`))
					.forEach(target => 
						expect(ship._data[target].value).to.equal(TEST_DATA[target].value * MODIFIERS[`${type}Value`]));
			});
		});		

		it('should not hoist the signal more than once', function() {
			ship.hoist(signal);
			ship.hoist(signal);
			expect(ship.engine.value).to.equal(TEST_DATA.AB1_Engine.value * MODIFIERS.EngineValue);
			expect(ship.artillery.value).to.equal(TEST_DATA.AB1_Artillery.value * MODIFIERS.ArtilleryValue);
		});
	});

	describe('.lower', function() {
		const MODIFIERS = {
			EngineValue: 2,
			ArtilleryValue: 3
		}
		let signal;
		
		beforeEach(function() {
			signal = new Signal({
				modifiers: MODIFIERS
			});
			ship.hoist(signal);
		});

		it('should revert the effects of the signal', function() {
			ship.lower(signal);
			[ 'Artillery', 'Engine' ].forEach(type => {
				Object.keys(ship._data)
					.filter(key => key.endsWith(`_${type}`))
					.forEach(target => 
						expect(ship._data[target].value).to.equal(TEST_DATA[target].value));
			});
		});

		it('should not lower a signal that was not hoisted', function() {
			signal = new Signal({
				id: 999,
				index: 'PCEF999',
				name: 'PCEF999_OtherSignal',
				modifiers: {
					'ArtilleryValue': 5,
					'EngineValue': 4
				}
			});
			let engineValue = ship.engine.value;
			let artilleryValue = ship.artillery.value;
			ship.lower(signal);
			expect(ship.engine.value).to.equal(engineValue);
			expect(ship.artillery.value).to.equal(artilleryValue);
		});
	});

	it('should have property consumables which is a Ship.Consumables', function() {
		expect(ship).to.have.property('consumables');
		expect(ship.consumables).to.be.an('object');
		expect(ship.consumables).to.be.an.instanceof(Ship.Consumables);
	});

	describe('Ship.Consumables', function() {
		let consumables;
		
		beforeEach(function() {
			consumables = new Ship.Consumables(ship._data.ShipAbilities);
		});

		it('should be a hash of all consumables, with the consumableType as the key', function() {
			// Generator function that yields all the ships consumables one by one
			function* abilities() {
				yield ship._data.ShipAbilities.AbilitySlot0.abils[0];
				yield ship._data.ShipAbilities.AbilitySlot0.abils[1];
				yield ship._data.ShipAbilities.AbilitySlot1.abils[0];
			}

			for (let consumable of abilities()) {
				expect(consumables, consumable.consumableType).to
					.have.property(consumable.consumableType)
					.that.deep.equals(consumable);
			}
		});

		describe('.slotOf', function() {
			it('should return -1 for a consumable the ship does not have', function() {
				expect(consumables.slotOf('unknown_consumable_type'), 'with consumable type').to.equal(-1);
				let consumable = new Consumable({ 
					consumableType: 'unknown_consumable_type'
				});

				expect(consumables.slotOf(consumable), 'with consumable object').to.equal(-1);
			});

			it('should return the slot of the consumable', function() {
				expect(consumables.slotOf('consumable1'), 'with consumable type').to.equal(0);
				let consumable = consumables.consumable1;
				expect(consumables.slotOf(consumable), 'with consumable object').to.equal(0);
			});
		});

		describe('.getSlot', function() {
			it('should be a Ship.Consumables', function() {
				expect(consumables.getSlot(0)).to.be.an.instanceof(Ship.Consumables);
			});
			
			it('should return all consumables in the given slot', function() {
				let slot = consumables.getSlot(0);
				expect(slot).to.have.property('consumable1').that.deep.equals(consumables.consumable1);
				expect(slot).to.have.property('consumable2').that.deep.equals(consumables.consumable2);
			});

			it('should be empty if there are no consumables in that slot', function() {
				let slot = consumables.getSlot(5);
				expect(
					// Filter to only those properties that are consumables
					Object.values(slot).filter(val => val instanceof Consumable)
				).to.be.empty;
			});
		});

		describe('.asArray', function() {
			it('should return an array of all consumables', function() {
				let expected = Object.values(consumables).filter(val => val instanceof Consumable);
				expect(consumables.asArray()).to.be.an('array').with.members(expected);
			});

			it('should return an empty array if there are no consumables', function() {
				let consumables = new Ship.Consumables({ 
					AbilitySlot0: {},
					AbilitySlot1: {}
				});
				expect(consumables.asArray()).to.be.empty;
			});
		});
	});

	it('should have property refits which has all research options', function() {
		expect(ship).to.have.property('refits').that.deep.equals(ship._data.ShipUpgradeInfo);
	});
	
	describe('.multiply', function() {
		it('should multiply into modules', function() {
			const coeff = 2;
			let val = ship.engine.get('value');
			ship.multiply('engine.value', coeff);
			expect(ship.get('engine.value')).to.equal(val * coeff);
		});

		it('should multiply into consumables', function() {
			const coeff = 2;
			ship.multiply('consumables.consumable1.value', coeff);

			expect(ship.consumables.consumable1.value).to.equal(CONSUMABLE_DATA.PCY001_Consumable1.Flavor1.value * coeff);
		});
	});
});