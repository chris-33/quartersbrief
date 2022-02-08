import { Modernization } from '../../src/model/modernization.js';
import { Ship } from '../../src/model/ship.js';
import { GameObject } from '../../src/model/gameobject.js';
import { readFileSync } from 'fs';
import clone from 'just-clone';
import sinon from 'sinon';

describe('Modernization', function() {
	let TEST_DATA;
	let SHIP;

	before(function() {
		TEST_DATA = JSON.parse(readFileSync('test/model/testdata/modernization.json'));
		SHIP = JSON.parse(readFileSync('test/model/testdata/ship.json'));
	});

	it('should be a GameObject', function() {
		expect(new GameObject({})).to
			.be.an.instanceof(GameObject);
	});

	describe('.eligible', function() {
		let ship;
		let data;

		before(function() {
			ship = new Ship(SHIP);	
		});

		beforeEach(function() {
			data = clone(TEST_DATA);
		});

		it('should always find modernizations with slot -1 ineligible', function() {
			data.slot = -1;
			expect(new Modernization(data).eligible(ship)).to
				.be.false;
		});

		it('should always find whitelisted ships eligible', function() {
			data.ships = [ship.name];
			data.shiplevel = [];
			data.shiptype = [];
			expect(new Modernization(data).eligible(ship)).to
				.be.true;
		});

		it('should always find blacklisted ships ineligible', function() {
			data.excludes = [ship.name];
			expect(new Modernization(data).eligible(ship)).to
				.be.false;
		});

		it('should find a ship whose tier, nation and type match eligible', function() {
			expect(new Modernization(data).eligible(ship)).to
				.be.true;
		});

		it('should find a ship whose tier, nation, or type do not match ineligible', function() {
			data.shiplevel = [9,10];
			expect(new Modernization(data).eligible(ship)).to
				.be.false;
			data.shiplevel.push[8];
			data.nation = ['Germany'];
			expect(new Modernization(data).eligible(ship)).to
				.be.false;
			data.nation = [];
			data.shiptype = ['Destroyer'];
			expect(new Modernization(data).eligible(ship)).to
				.be.false;
		});
	});

	describe('.getModifiers', function() {
		let definitions;
		const MODERNIZATION_TARGETS = {
			ArtilleryValue: { target: 'artillery.value', retriever: () => null },
			EngineValue: { target: 'engine.value', retriever: () => null }
		};

		before(function() {
			definitions = Modernization.MODERNIZATION_TARGETS;			
			Modernization.MODERNIZATION_TARGETS = MODERNIZATION_TARGETS;
		});

		it('should return modifier objects only for those modifiers where it is known how to deal with them', function() {
			let modernization = new Modernization(TEST_DATA);
			expect(modernization.getModifiers()).to
				.be.an('array')
				.with.lengthOf(2);

		});

		it('should return correct targets', function() {
			let modernization = new Modernization(TEST_DATA);
			let targets = modernization.getModifiers().map(modifier => modifier.target);
			expect(targets).to
				.be.an('array')
				.with.members([MODERNIZATION_TARGETS.ArtilleryValue.target, MODERNIZATION_TARGETS.EngineValue.target]);
		});

		it('should return correct retrievers', sinon.test(function() {
			let spy1 = sinon.spy(MODERNIZATION_TARGETS.EngineValue, 'retriever');
			let spy2 = sinon.spy(MODERNIZATION_TARGETS.ArtilleryValue, 'retriever');

			let modernization = new Modernization(TEST_DATA);
			let ship = {};

			let retrievers = modernization.getModifiers().map(modernization => modernization.retriever);
			expect(retrievers).to
				.be.an('array')
				.and.satisfy((arr) => arr.every(el => typeof el === 'function'), `expected retrievers to be an array of functions but it was an array of ${typeof retrievers[0]}s`);
			
			retrievers.forEach(retriever => retriever(ship));

			expect(spy1).to
				.have.been.calledOn(modernization)
				.and.been.calledWith(TEST_DATA.modifiers.EngineValue, ship);
			expect(spy2).to
				.have.been.calledOn(modernization)
				.and.been.calledWith(TEST_DATA.modifiers.ArtilleryValue, ship);

		}));
		after(function() {
			Modernization.MODERNIZATION_TARGETS = definitions;
		});
	});
});
