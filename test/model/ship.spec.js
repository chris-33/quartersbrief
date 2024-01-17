import Ship from '../../src/model/ship.js';
import Modernization from '../../src/model/modernization.js';
import Captain from '../../src/model/captain.js';
import Consumable from '../../src/model/consumable.js';
import Signal from '../../src/model/signal.js';
import Modifier from '../../src/model/modifier.js';
import Module from '../../src/model/modules/module.js';
import sinon from 'sinon';
import clone from 'lodash/cloneDeep.js';

describe('Ship', function() {
	const EXPOSED_PROPERTY_DESCRIPTOR = {
		get: function() { return this._data.value },
		set: function(value) { this._data.value = value },
		enumerable: true,
		configurable: true
	}
	
	const AB1_Engine = { value: 1 };
	const AB1_Artillery = { value: 1 };
	
	const SHIP = {
		AB1_Engine,
		AB1_Artillery,
		name: 'PAAA001_Battleship',
		index: 'PAAA001',
		id: 1,
		level: 8,
		ShipUpgradeInfo: {
			hull: [{
				components: {
					engine: [ AB1_Engine ],
					artillery: [ AB1_Artillery ]
				}
			}]
		},
		typeinfo: { 
			nation: 'USA',
			species: 'Battleship',
			type: 'Ship'
		}
	}
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

	beforeEach(function() {
		ship = new Ship(clone(SHIP));		
	});

	after(function() {
		Modifier.KNOWN_TARGETS = knownTargets;
		Captain.CLASS_SKILLS = classSkills;

		delete Module.prototype.value;
	});

	describe('.equipModules', function() {
		const MODULES = {
			AB1_Engine,
			AB2_Engine: { value: 2 },
			AB1_Artillery,
			AB1_FireControl: { value: 1 },
			AB2_FireControl: { value: 2 },
			AB3_FireControl: { value: 3 },
		}
		/* eslint-disable mocha/no-setup-in-describe */
		const REFITS = {
			engine: [		
				{ components: { engine: [ MODULES.AB1_Engine ] }},
				{ components: { engine: [ MODULES.AB2_Engine ] }}
			],
			artillery: [
				{ components: { artillery: [ MODULES.AB1_Artillery ] }}
			],
			suo: [
				{ components: { fireControl: [ MODULES.AB1_FireControl ] }},
				{ components: { fireControl: [ MODULES.AB2_FireControl ] }},
				{ components: { fireControl: [ MODULES.AB3_FireControl ] }}
			]
		}
		/* eslint-enable mocha/no-setup-in-describe */

		beforeEach(function() {
			ship = new Ship(clone(Object.assign({}, SHIP, MODULES, { ShipUpgradeInfo: REFITS })));
		});

		it('should equip the beginnings of the module lines when applying the stock configuration', function() {
			let expected = {
				artillery: MODULES.AB1_Artillery,
				engine: MODULES.AB1_Engine,
				fireControl: MODULES.AB1_FireControl
			};

			ship.equipModules('stock');

			for (let key in expected) 
				expect(ship[key], key).to.deep.equal(expected[key]);
		});

		it('should equip the ends of the module lines when applying the top configuration', function() {
			let expected = {
				artillery: MODULES.AB1_Artillery,
				engine: MODULES.AB2_Engine,
				fireControl: MODULES.AB3_FireControl
			};

			ship.equipModules('top');

			for (let key in expected) 
				expect(ship[key], key).to.deep.equal(expected[key]);
		});

		it('should throw a TypeEror when a complex configuration doesn\'t define all modules', function() {
			expect(ship.equipModules.bind(ship, 'engine: stock')).to.throw(TypeError);
			expect(ship.equipModules.bind(ship, '')).to.throw(TypeError);
			expect(ship.equipModules.bind(ship, 'malformed')).to.throw(TypeError);
		});

		it('should equip the specified combination of modules when applying a more specific configuration', function() {
			let expected = {
				artillery: MODULES.AB1_Artillery,
				engine: MODULES.AB1_Engine,
				fireControl: MODULES.AB2_FireControl
			};

			ship.equipModules('engine: stock, suo: 1, others: top');

			for (let key in expected) 
				expect(ship[key]).to.deep.equal(expected[key]);
		});

		it('should apply modules\' modifiers', function() {
			const MODIFIERS = {
				EngineValue: 2,
				ArtilleryValue: 3
			}
			// Turn the top fire control module into a Module with modifiers	
			Object.setPrototypeOf(ship.refits.suo[2].components.fireControl[0], Module.prototype);
			sinon.stub(ship.refits.suo[2].components.fireControl[0], 'getModifiers').returns(Object.keys(MODIFIERS).flatMap(key => Modifier.from(key, MODIFIERS[key])))
		
			ship.equipModules('top');
			[ 'AB1_Engine', 'AB2_Engine' ].forEach(target => 
				expect(ship._data[target].value).to.equal(MODULES[target].value * MODIFIERS.EngineValue));
			[ 'AB1_Artillery' ].forEach(target => 
				expect(ship._data[target].value).to.equal(MODULES[target].value * MODIFIERS.ArtilleryValue));
		});

		it('should revert modules\' modifiers when changing configuration', function() {
			const MODIFIERS = {
				EngineValue: 2
			}
			const ENGINES = [ 'AB1_Engine', 'AB2_Engine' ];
			// Turn the top fire control module into a Module with modifiers	
			Object.setPrototypeOf(ship.refits.suo[2].components.fireControl[0], Module.prototype);
			sinon.stub(ship.refits.suo[2].components.fireControl[0], 'getModifiers').returns(Object.keys(MODIFIERS).flatMap(key => Modifier.from(key, MODIFIERS[key])))

			ship.equipModules('top');
			const vals = ENGINES.map(target => ship._data[target].value);
			ship.equipModules('stock');


			ENGINES.forEach((target, index) => 
				expect(ship._data[target].value).to.equal(vals[index] / MODIFIERS.EngineValue));
		});

		it('should retain modernization effects after changing module configuration', function() {
			const MODIFIERS = {
				EngineValue: 2
			}
			let modernization = new Modernization({
				modifiers: MODIFIERS
			});
			sinon.stub(modernization, 'eligible').returns(true);

			ship.equipModules('stock');
			ship.equipModernization(modernization);
			expect(ship.engine.value).to.equal(MODIFIERS.EngineValue * MODULES.AB1_Engine.value);
			
			ship.equipModules('top');
			expect(ship.engine.value).to.equal(MODIFIERS.EngineValue * MODULES.AB2_Engine.value);
		});

		it('should retain captain skill effects after changing module configuration', function() {
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
			expect(ship.engine.value).to.equal(SKILLS.Skill1.modifiers.EngineValue * MODULES.AB1_Engine.value);

			ship.equipModules('top');
			expect(ship.engine.value).to.equal(SKILLS.Skill1.modifiers.EngineValue * MODULES.AB2_Engine.value);
		});

		it('should retain signal effects after changing module configuration', function() {
			const MODIFIERS = {
				EngineValue: 2
			}
			let signal = new Signal({ modifiers: MODIFIERS });
			
			ship.equipModules('stock');
			ship.hoist(signal);
			expect(ship.engine.value).to.equal(MODIFIERS.EngineValue * MODULES.AB1_Engine.value);
			ship.equipModules('top');
			expect(ship.engine.value).to.equal(MODIFIERS.EngineValue * MODULES.AB2_Engine.value);			
		});
	});

	describe('.equipModernization', function() {
		let modernization;		
		const MODIFIERS = {
			EngineValue: 2,
			ArtilleryValue: 3
		}
		const MODULES = {
			AB1_Engine,
			AB2_Engine: { value: 2 },
			AB1_Artillery,
			AB2_Artillery: { value: 2 },
		}

		beforeEach(function() {
			ship = new Ship(clone(Object.assign({}, SHIP, MODULES, {
				ShipUpgradeInfo: {
					everything: [ 
						{ components: { engine: [ MODULES.AB1_Engine ], artillery: [ MODULES.AB1_Artillery ] }},
						{ components: { engine: [ MODULES.AB2_Engine ], artillery: [ MODULES.AB2_Artillery ] }}
					]
				}
			})));
		});

		beforeEach(function() {
			modernization = new Modernization({	
				excludes: [],
				modifiers: MODIFIERS,
			});
			sinon.stub(modernization, 'eligible').returns(true);
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

			[ 'AB1_Engine', 'AB2_Engine' ].forEach(target => 
				expect(ship._data[target].value).to.equal(MODULES[target].value * MODIFIERS.EngineValue));
			[ 'AB1_Artillery', 'AB2_Artillery' ].forEach(target => 
				expect(ship._data[target].value).to.equal(MODULES[target].value * MODIFIERS.ArtilleryValue));
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
						expect(ship._data[target].value).to.equal(SHIP[target].value));
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
						expect(ship._data[target].value).to.equal(SHIP[target].value * MODIFIERS[`${type}Value`]));
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
					expect(ship._data[target].value).to.equal(SHIP[target].value));
		});

		it('should remove a previously set captain when setting to null', function() {
			ship.setCaptain(captain);
			ship.setCaptain(null);

			[ 'Artillery', 'Engine' ].forEach(type => {
				Object.keys(ship._data)
					.filter(key => key.endsWith(`_${type}`))
					.forEach(target => 
						expect(ship._data[target].value).to.equal(SHIP[target].value));
			});
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
						expect(ship._data[target].value).to.equal(SHIP[target].value * MODIFIERS[`${type}Value`]));
			});
		});		

		it('should not hoist the signal more than once', function() {
			ship.hoist(signal);
			ship.hoist(signal);
			expect(ship.engine.value).to.equal(SHIP.AB1_Engine.value * MODIFIERS.EngineValue);
			expect(ship.artillery.value).to.equal(SHIP.AB1_Artillery.value * MODIFIERS.ArtilleryValue);
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
						expect(ship._data[target].value).to.equal(SHIP[target].value));
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

		const CONSUMABLE1 = new Consumable({ value: 1, consumableType: 'consumable1' });
		const CONSUMABLE2 = new Consumable({ value: 2, consumableType: 'consumable2' });
		const CONSUMABLE3 = new Consumable({ value: 3, consumableType: 'consumable3' });
		const ABILITIES = {
			AbilitySlot0: {
				abils: [ CONSUMABLE1, CONSUMABLE2 ],
				slot: 0
			},
			AbilitySlot1: {
				abils: [ CONSUMABLE3 ],
				slot: 1
			}
		}
		beforeEach(function() {
			const data = Object.assign({}, SHIP, { ShipAbilities: ABILITIES });
			for (let abilityDef of [ ABILITIES.AbilitySlot0.abils[0], ABILITIES.AbilitySlot0.abils[1], ABILITIES.AbilitySlot1.abils[0] ]) {
				Object.defineProperty(abilityDef, 'value', EXPOSED_PROPERTY_DESCRIPTOR)
			}
			ship = new Ship(data);
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
});