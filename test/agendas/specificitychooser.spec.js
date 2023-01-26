import SpecificityChooser from '../../src/agendas/specificitychooser.js';
import Agenda from '../../src/agendas/agenda.js';
import Battle from '../../src/model/battle.js';
import Ship from '../../src/model/ship.js';
import GameObjectFactory from '../../src/model/gameobjectfactory.js';
import sinon from 'sinon';

describe('SpecificityChooser', function() {
	const SHIP_DATA = {
		name: 'PAAA001_Battleship',
		class: 'Battleship',
		tier: 8,
		nation: 'USA'
	}

	let chooser;
	let ship;

	before(function() {
		ship = Object.create(Ship.prototype);
		for (let prop in SHIP_DATA) {
			const getter = `get${prop.charAt(0).toUpperCase()}${prop.substring(1)}`;
			sinon.stub(ship, getter).returns(SHIP_DATA[prop]);
		}
		let gameObjectFactory = new GameObjectFactory();
		sinon.stub(gameObjectFactory, 'createGameObject').returns(ship);
		chooser = new SpecificityChooser(gameObjectFactory);
	});

	it('should throw if created without a GameObjectFactory', function() {
		expect(() => new SpecificityChooser(), 'undefined').to.throw();
		expect(() => new SpecificityChooser({}), 'not a GameObjectFactory').to.throw();
	});

	describe('.scoreOf', function() {
		it('should return 0 for an empty matcher', function() {
			expect(chooser.scoreOf({})).to.equal(0);
		});

		it('should award the correct points for matching ships, classes, nations, and tiers', function() {			
			const clauses = {
				ships: [ ship.getName() ],
				classes: [ ship.getClass() ],
				tiers: [ ship.getTier() ],
				nations: [ ship.getNation() ]
			}
			for (let clause in clauses)
				expect(chooser.scoreOf({ [clause]: clauses[clause] }), clause).to
					.equal(SpecificityChooser.POINTS[clause]);
		});
	});

	describe('.choose', function() {
		let battle;

		before(function() {
			battle = new Battle();
			sinon.stub(battle, 'getPlayer').returns({});
		});

		it('should return null if there are no agendas', function() {			
			expect(chooser.choose(battle, [])).to.be.null;
		});

		it('should return null if no agendas fit', function() {
			const agenda = new Agenda();
			sinon.stub(agenda, 'matches').returns(null);

			expect(chooser.choose(battle, [ agenda ])).to.be.null;
		});

		it('should return an agenda with score 0 if no others fit', function() {
			const agenda = new Agenda();
			sinon.stub(agenda, 'matches').returns([{}]);

			sinon.stub(chooser, 'scoreOf').returns(0);
			try {
				expect(chooser.choose(battle, [ agenda ])).to.equal(agenda);
			} finally {
				chooser.scoreOf.restore();
			}			
		});

		it('should return the agenda with the highest score', function() {
			const agendas = [];
			const matchers = [];
			for (let i = 0; i < 3; i++) {
				const matcher = {};
				const agenda = new Agenda(matcher);
				agendas.push(agenda);
				matchers.push(matcher);
			}

			// Make each match's score its index
			sinon.stub(chooser, 'scoreOf');			
			matchers.forEach((matcher, index) => chooser.scoreOf.withArgs(sinon.match.same(matcher)).returns(index)); // sinon.match.same: Use strict equality instead of deep equality for arg matching
			
			try {
				expect(chooser.choose(battle, agendas)).to.equal(agendas.at(-1));
			} finally {
				chooser.scoreOf.restore();
			}
		});
	});
});