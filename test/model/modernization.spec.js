import Modernization from '../../src/model/modernization.js';
import Ship from '../../src/model/ship.js';
import Modifier from '../../src/model/modifier.js';
import clone from 'lodash/cloneDeep.js';

describe('Modernization', function() {
	const MODERNIZATION = {
		excludes: [],
		modifiers: {
			EngineValue: 2,
			ArtilleryValue: 3,
			unknown: 0
		},
		shiplevel: [8,9,10],
		nation: [],
		shiptype: [ 'Destroyer', 'Battleship' ],
		slot: 0,
		ships: [],
		name: 'PCM001_Modernization',
		index: 'PCM001',
		id: 2			
	}

	describe('.eligible', function() {
		let ship;
		let data;

		before(function() {
			ship = Object.create(Ship.prototype, {
				name: { value: 'PAAA001_Test1' },
				tier: { value: 8 },
				class: { value: 'Battleship' },
				nation: { value: 'USA' },
			});
		});

		beforeEach(function() {
			data = clone(MODERNIZATION);
		});

		it('should always find modernizations with slot -1 ineligible', function() {
			data.slot = -1;
			expect(new Modernization(data).eligible(ship)).to.be.false;
		});

		it('should always find whitelisted ships eligible', function() {
			data.ships = [ ship.name ];
			data.shiplevel = [];
			data.shiptype = [];

			expect(new Modernization(data).eligible(ship)).to.be.true;
		});

		it('should always find blacklisted ships ineligible', function() {
			data.excludes = [ ship.name ];

			expect(new Modernization(data).eligible(ship)).to.be.false;
		});

		it('should find a ship whose tier, nation and type match eligible', function() {			
			expect(new Modernization(data).eligible(ship)).to.be.true;
		});

		it('should find a ship whose tier, nation, or type do not match ineligible', function() {
			data.shiplevel = [ 9, 10 ];
			expect(new Modernization(data).eligible(ship)).to.be.false;

			data.shiplevel = [ 8 ];
			data.nation = ['Germany'];
			expect(new Modernization(data).eligible(ship)).to.be.false;

			data.nation = [];
			data.shiptype = ['Destroyer'];
			expect(new Modernization(data).eligible(ship)).to.be.false;
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
			let modernization = new Modernization(MODERNIZATION);
			expect(modernization.getModifiers()).to
				.be.an('array')
				.with.lengthOf(2);
		});
	});
});