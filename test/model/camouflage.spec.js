import { Camouflage } from '../../src/model/camouflage.js';
import { Ship } from '../../src/model/ship.js';
import { Modifier } from '../../src/util/modifier.js';
import { readFileSync } from 'fs';

describe('Camouflage', function() {
	let TEST_DATA;

	before(function() {
		TEST_DATA = JSON.parse(readFileSync('test/model/testdata/camouflage.json'));
	});

	describe('.eligible', function() {
		let ship;

		beforeEach(function() {
			ship = new Ship(JSON.parse(readFileSync('test/model/testdata/ship.json')));
		});

		it('should always consider expendable camouflages eligible', function() {
			let camouflage = new Camouflage(TEST_DATA);
			camouflage.set('typeinfo.species', 'Camouflage');
			expect(camouflage.eligible(ship)).to.be.true;
		});

		it('should consider a permoflage eligible for a ship if it is listed by that ship, ineligible otherwise', function() {
			let camouflage = new Camouflage(TEST_DATA);
			camouflage.set('typeinfo.species', 'Permoflage');
			ship.set('permoflages', [camouflage]);
			expect(camouflage.eligible(ship)).to.be.true;
			ship.set('permoflages', []);
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
			let camouflage = new Camouflage(TEST_DATA);
			camouflage.set('typeinfo.species', 'Permoflage');
			expect(camouflage.isPermoflage()).to.be.true;
			camouflage.set('typeinfo.species', 'Camouflage');
			expect(camouflage.isPermoflage()).to.be.false;
		});
	});
});