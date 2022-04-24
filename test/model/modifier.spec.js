import { Modifier } from '../../src/model/modifier.js';
import { Ship } from '../../src/model/ship.js';
import { readFileSync } from 'fs';
import clone from 'clone';

describe('Modifier', function() {
	let knownTargets;
	let SHIPDATA;

	before(function() {
		knownTargets = Modifier.KNOWN_TARGETS;
		SHIPDATA = JSON.parse(readFileSync('test/model/testdata/ship.json'));
		Modifier.KNOWN_TARGETS = { EngineValue: 'engine.value', ArtilleryValue: 'artillery.value' };
	});

	after(function() {
		Modifier.KNOWN_TARGETS = knownTargets;
	});

	describe('Modifier.from', function() {
		it('should map a known key name to a target and an unknown key name to undefined', function() {
			expect(Modifier.from('EngineValue', 2).target).to.equal(Modifier.KNOWN_TARGETS.EngineValue);
			expect(Modifier.from('UnknownValue', 2).target).to.not.exist;
		});
	});

	describe('.invert', function() {
		it('should have 1 / value as its value', function() {
			const value = 5;
			let modifier = new Modifier('target', value);
			expect(modifier.invert().value).to.equal(1 / value);
		});

		it('should negate the effects of the original modifier when applying', function() {
			let ship = new Ship(clone(SHIPDATA));
			let modifier = new Modifier('engine.value', 2);
			let val = ship.get('engine.value');
			modifier.applyTo(ship);
			modifier.invert().applyTo(ship);
			expect(ship.get('engine.value')).to.equal(val);
		})
	});

	describe('.applyTo', function() {
		it('should throw only if trying to apply to something other than a ship, or if the value is not a number or a mapping from species to number', function() {
			// Check that it errors when trying to apply to anything other than a ship
			let modifier = new Modifier('engine.value', 1);
			expect(modifier.applyTo.bind(modifier, {}), 'applying to something other than a ship').to
				.throw(TypeError);

			// Check that it throws on a malformed value
			let ship = new Ship(clone(SHIPDATA));
			modifier.value = '';
			expect(modifier.applyTo.bind(modifier, ship), 'applying with a malformed primitive value').to
				.throw(TypeError);
			modifier.value = { a: 2 };
			expect(modifier.applyTo.bind(modifier, ship), 'applying with a malformed object value').to
				.throw(TypeError);

			// Check that it works on a well-formed primitive value and ship
			modifier.value = 1;
			expect(modifier.applyTo.bind(modifier, ship), 'applying with a well-formed primitive value').to
				.not.throw();
			// Check that it works on a well-formed object value and ship
			modifier.value = {};
			modifier.value[ship.getSpecies()] = 1;
			expect(modifier.applyTo.bind(modifier, ship), 'applying with a well-formed object value').to
				.not.throw();
		});

		it('should multiply the ship\'s value with the modifier value', function() {
			let modifier = new Modifier('engine.value', 2);
			let ship = new Ship(clone(SHIPDATA));

			let val = ship.engine.value;
			modifier.applyTo(ship);
			expect(ship.engine.value, 'applying a primitive value').to.equal(val * modifier.value);

			modifier = new Modifier('artillery.value', {});
			modifier.value[ship.getSpecies()] = 2;
			val = ship.artillery.value;
			modifier.applyTo(ship);
			expect(ship.artillery.value, 'applying an object value').to.equal(val * modifier.value[ship.getSpecies()]);
		});
	});

})