import SpecificityChooser from '../../src/briefing/specificitychooser.js';
import { Agenda } from '../../src/briefing/agenda.js';
import { Battle } from '../../src/model/battle.js';
import { Ship } from '../../src/model/ship.js';
import { GameObjectFactory } from '../../src/model/gameobjectfactory.js';
import { readFileSync } from 'fs';
import sinon from 'sinon';

describe.only('SpecificityChooser', function() {
	let TEST_DATA;
	const SHIP_DATA = {
		name: 'PAAA001_Battleship',
		class: 'Battleship',
		tier: 8,
		nation: 'USA'
	}

	let strategy;
	let ship;
	before(function() {
		TEST_DATA = JSON.parse(readFileSync('test/briefing/testdata/agendas.json'));
		ship = Object.create(Ship.prototype);
		for (let prop in SHIP_DATA) {
			const getter = `get${prop.charAt(0).toUpperCase()}${prop.substring(1)}`;
			sinon.stub(ship, getter).returns(SHIP_DATA[prop]);
		}
		let gameObjectFactory = new GameObjectFactory();
		sinon.stub(gameObjectFactory, 'createGameObject').returns(ship);
		strategy = new SpecificityChooser(gameObjectFactory);
	});

	it('should throw if created without a GameObjectFactory', function() {
		expect(() => new SpecificityChooser(), 'undefined').to.throw();
		expect(() => new SpecificityChooser({}), 'not a GameObjectFactory').to.throw();
	});

	describe('.scoreOf', function() {
		it('should return 0 if the agenda has an empty matcher, or no matcher at all', function() {
			expect(strategy.scoreOf(null, new Agenda(null, null))).to.equal(0);
			expect(strategy.scoreOf(null, new Agenda(null, {}))).to.equal(0);
		});

		it('should award the correct points for matching ships, classes, nations, and tiers', function() {			
			const matchers = {
				ships: [ ship.getName() ],
				classes: [ ship.getClass() ],
				tiers: [ ship.getTier() ],
				nations: [ ship.getNation() ]
			}
			for (let prop in matchers)
				expect(strategy.scoreOf(ship, new Agenda({ [prop]: matchers[prop] })), prop).to
					.equal(SpecificityChooser.POINTS[prop]);
		});

		it('should return a negative number for not matching a present ships, classes, nations or tiers', function() {
			[ 'ships', 'classes', 'tiers', 'nations' ].forEach(prop => 
				expect(strategy.scoreOf(ship, new Agenda({ [prop]: [ 'not matching ship' ]}))).to
					.be.below(0));
		});
	});

	describe('.choose', function() {
		let battle;

		before(function() {
			battle = new Battle();
			sinon.stub(battle, 'getPlayer').returns({});
		});

		it('should return null if there are no agendas', function() {			
			expect(strategy.choose(battle, [])).to.be.null;
		});

		it('should return null if no agendas fit', function() {
			let agendas = TEST_DATA.map(agenda => new Agenda(agenda.matches, null));
			sinon.stub(strategy, 'scoreOf').returns(-10000);
			try {
				expect(strategy.choose(battle, agendas)).to.be.null;
			} finally {
				strategy.scoreOf.restore();
			}
		});

		it('should return an agenda with score 0 if no others fit', function() {
			let agendas = TEST_DATA.map(agenda => new Agenda(agenda.matches, null));
			sinon.stub(strategy, 'scoreOf').returns(-10000);
			strategy.scoreOf.onFirstCall().returns(0);			
			try {
				expect(strategy.choose(battle, agendas)).to.equal(agendas[0]);
			} finally {
				strategy.scoreOf.restore();
			}			
		});

		it('should return the agenda with the highest score', function() {
			let agendas = TEST_DATA.map(agenda => new Agenda(agenda.matches, null))

			// Make each agenda's index its score
			sinon.stub(strategy, 'scoreOf');
			agendas.forEach((agenda, index) => strategy.scoreOf.withArgs(sinon.match.any, agenda).returns(index));
			
			try {				
				expect(strategy.choose(battle, agendas)).to.equal(agendas[agendas.length - 1]);
			} finally {
				strategy.scoreOf.restore();
			}
		});
	});
});