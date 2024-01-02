import Modifier from '../../src/model/modifier.js';
import Ship from '../../src/model/ship.js';
import { getModuleLines } from '../../src/model/ship-research.js';
import { readFileSync } from 'fs';
import clone from 'lodash/cloneDeep.js';
import sinon from 'sinon';

describe('Modifier', function() {
	let knownTargets;
	let SHIPDATA;

	before(function() {
		knownTargets = Modifier.KNOWN_TARGETS;
		SHIPDATA = JSON.parse(readFileSync('test/model/testdata/ship.json'));		
		SHIPDATA.ShipUpgradeInfo = getModuleLines(SHIPDATA.ShipUpgradeInfo);

		Modifier.KNOWN_TARGETS = { 
			EngineValue: 'engine.value',
			ArtilleryValue: [
				'artillery.value',
				'artillery.otherValue'
			],
			HullValue: {
				target: 'hull.value',
				calc: (ship, baseValue) => 2 * ship.tier * baseValue,
				mode: 'add'
			}
		};
	});
	let ship;
	beforeEach(function() {
		const data = {
			AB1_Artillery: { value: 1 },
			AB1_Engine: { value: 1 },
			A_Hull: { value: 1 },
			level: 8,
			typeinfo: { 
				type: 'Ship',
				species: 'Battleship',
				nation: 'USA'
			}
		}
		ship = Object.create(Ship.prototype, Object.getOwnPropertyDescriptors({
			_data: data,
			artillery: data.AB1_Artillery,
			engine: data.AB1_Engine,
			hull: data.A_Hull
		}));
	});

	after(function() {
		Modifier.KNOWN_TARGETS = knownTargets;
	});

	describe('Modifier.from', function() {
		it('should map a known key name to a single target', function() {			
			expect(Modifier.from('EngineValue', 2).map(modifier => modifier.target)).to
				.be.an('array').with.deep.members([ Modifier.KNOWN_TARGETS.EngineValue ]);
		});

		it('should map a known key name to a list of targets', function() {
			expect(Modifier.from('ArtilleryValue', 3).map(modifier => modifier.target)).to
				.be.an('array').with.deep.members(Modifier.KNOWN_TARGETS.ArtilleryValue);
		});

		it('should map a known key name to a descriptor', function() {
			let modifiers = Modifier.from('HullValue', 3);
			expect(modifiers).to
				.be.an('array');
			expect(modifiers[0]).to.be.an('object').that.includes(Modifier.KNOWN_TARGETS.HullValue);
		});

		it('should map an unknown key name to undefined', function() {
			expect(Modifier.from('UnknownValue', 2).map(modifier => modifier.target)).to
				.be.an('array').with.members([ undefined ]);
		});
	});

	describe('.invert', function() {
		it('should throw for a modifier in \'set\' mode', function() {
			let modifier = new Modifier('target', 0, null, 'set');
			expect(modifier.invert.bind(modifier)).to.throw();
		});

		it('should negate the effects of the original modifier when applying', function() {
			const _ship = clone(ship);
			[
				{ desc: 'target', value: 5 },
				{ desc: 'object', value: { Battleship: 3 }},
				{ desc: 'add mode', value: 5, mode: 'add' },
				{ desc: 'with calc function', value: 5, calc: (ship, baseValue) => 2 ** (ship.tier * baseValue) }
			].forEach(test => {
				ship = clone(_ship);
				let modifier = new Modifier('engine.value', test.value, test.calc, test.mode);
				let val = ship.engine.value;
				modifier.applyTo(ship);
				modifier.invert().applyTo(ship);
				expect(ship.engine.value, test.desc).to.equal(val);
			});
		});
	});

	describe('.applyTo', function() {
		it('should throw only if trying to apply to something other than a ship, or if the value is not a number or a mapping from species to number (default calc function)', function() {
			// Check that it errors when trying to apply to anything other than a ship
			let modifier = new Modifier('engine.value', 1);
			expect(modifier.applyTo.bind(modifier, {}), 'applying to something other than a ship').to.throw(TypeError);

			// Check that it throws on a malformed value
			modifier.value = '';
			expect(modifier.applyTo.bind(modifier, ship), 'applying with a malformed primitive value').to.throw(TypeError);
			modifier.value = { a: 2 };
			expect(modifier.applyTo.bind(modifier, ship), 'applying with a malformed object value').to.throw(TypeError);

			// Check that it works on a well-formed primitive value and ship
			modifier.value = 1;
			expect(modifier.applyTo.bind(modifier, ship), 'applying with a well-formed primitive value').to.not.throw();
			// Check that it works on a well-formed object value and ship
			modifier.value = {};
			modifier.value[ship.species] = 1;
			expect(modifier.applyTo.bind(modifier, ship), 'applying with a well-formed object value').to.not.throw();
		});

		it('should multiply the ship\'s value with the modifier value (default mode)', function() {
			let modifier = new Modifier('engine.value', 2);

			let val = ship.engine.value;
			modifier.applyTo(ship);
			expect(ship.engine.value, 'applying a primitive value').to.equal(val * modifier.value);

			modifier = new Modifier('artillery.value', { [ship.species]: 2 });
			val = ship.artillery.value;
			modifier.applyTo(ship);
			expect(ship.artillery.value, 'applying an object value').to.equal(val * modifier.value[ship.species]);
		});

		it('should run the calculation function when applying', function() {
			const baseValue = 2;
			let modifier = new Modifier('hull.value', baseValue, () => 2 ** baseValue);
			let calc = sinon.spy(modifier, 'calc');

			let val = ship.hull.value;
			modifier.applyTo(ship);
			expect(calc).to.have.been.calledWith(ship, baseValue);
			expect(ship.hull.value, 'applying with a calculation function').to.equal(val * modifier.calc(ship, baseValue));
		});

		it('should use the mode when applying', function() {
			let modifier = new Modifier('engine.value', 2, null, 'add');
			let val = ship.engine.value;

			modifier.applyTo(ship);
			expect(ship.engine.value, 'add').to.equal(val + modifier.value);
			
			modifier = new Modifier('artillery.value', 5, null, 'set');
			val = ship.artillery.value;
			modifier.applyTo(ship);
			expect(ship.artillery.value).to.equal(modifier.value);
		});
	});

})