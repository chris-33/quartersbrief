import Camouflage from '../../src/model/camouflage.js';
import Ship from '../../src/model/ship.js';
import Modifier from '../../src/model/modifier.js';
import { readFileSync } from 'fs';
import clone from 'lodash/cloneDeep.js';

describe('Camouflage', function() {
	let TEST_DATA;
	let SHIP_DATA;

	before(function() {
		TEST_DATA = JSON.parse(readFileSync('test/model/testdata/camouflage.json'));
		SHIP_DATA = JSON.parse(readFileSync('test/model/testdata/ship.json'));
	});

	describe('.eligible', function() {
		let ship;

		beforeEach(function() {
			ship = new Ship(SHIP_DATA);
		});

		it('should always consider expendable camouflages eligible', function() {
			let data = clone(TEST_DATA);
			data.typeinfo.species = 'Camouflage';
			let camouflage = new Camouflage(data);
			expect(camouflage.eligible(ship)).to.be.true;
		});

		it('should consider a permoflage eligible for a ship if it is listed by that ship, ineligible otherwise', function() {
			let data = clone(TEST_DATA);
			data.typeinfo.species = 'Permoflage';
			let camouflage = new Camouflage(data);


			ship = clone(SHIP_DATA);
			ship.permoflages = [camouflage];
			ship = new Ship(ship);
			expect(camouflage.eligible(ship)).to.be.true;
			
			ship = clone(SHIP_DATA);
			ship.permoflages = [];
			ship = new Ship(ship);
			expect(camouflage.eligible(ship)).to.be.false;
		});
	});

	describe('.getModifiers', function() {
		let knownTargets;

		before(function() {
			knownTargets = Modifier.KNOWN_TARGETS;
			Modifier.KNOWN_TARGETS = { EngineValue: 'engine.value', ArtilleryValue: 'artillery.value' };
		});

		after(function() {
			Modifier.KNOWN_TARGETS = knownTargets;
		});

		it('should return modifier objects only for those modifiers where it is known how to deal with them', function() {
			let camouflage = new Camouflage(TEST_DATA);
			expect(camouflage.getModifiers()).to
				.be.an('array')
				.with.lengthOf(2);
		});
	});

	describe('.isPermoflage', function() {
		it('should return true if and only if the camouflage is a permanent one', function() {
			let data = clone(TEST_DATA);
			data.typeinfo.species = 'Permoflage';
			let camouflage = new Camouflage(data);
			expect(camouflage.isPermoflage()).to.be.true;

			data.typeinfo.species = 'Camouflage';
			camouflage = new Camouflage(data);
			expect(camouflage.isPermoflage()).to.be.false;
		});
	});
});