import SpecificityChooser from '../../src/agendas/specificitychooser.js';
import Agenda from '../../src/agendas/agenda.js';
import Battle from '../../src/model/battle.js';
import Ship from '../../src/model/ship.js';
import GameObjectProvider from '../../src/providers/gameobjectprovider.js';
import sinon from 'sinon';

describe('SpecificityChooser', function() {
	const SHIP_DATA = {
		name: 'PAAA001_Battleship',
		tier: 8,
		typeinfo: {
			type: 'Ship',
			nation: 'USA',
			species: 'Battleship',
		}
	}

	let chooser;
	let ship;

	beforeEach(function() {
		ship = Object.create(Ship.prototype);
		ship._data = SHIP_DATA;

		let gameObjectProvider = new GameObjectProvider();
		sinon.stub(gameObjectProvider, 'createGameObject').resolves(ship);
		chooser = new SpecificityChooser(gameObjectProvider);
	});

	it('should throw if created without a GameObjectProvider', function() {
		expect(() => new SpecificityChooser(), 'undefined').to.throw();
		expect(() => new SpecificityChooser({}), 'not a GameObjectProvider').to.throw();
	});

	describe('.scoreOf', function() {
		it('should return 0 for an empty matcher', function() {
			expect(chooser.scoreOf({})).to.equal(0);
		});

		it('should award the correct points for matching ships, classes, nations, and tiers', function() {			
			const clauses = {
				ships: [ ship.name ],
				classes: [ ship.class ],
				tiers: [ ship.tier ],
				nations: [ ship.nation ]
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
			Object.defineProperty(battle, 'player', { value: {} });
		});

		it('should return null if there are no agendas', function() {			
			return expect(chooser.choose(battle, [])).to.eventually.be.null;
		});

		it('should return null if no agendas fit', function() {
			const agenda = new Agenda();
			sinon.stub(agenda, 'matches').returns(null);

			return expect(chooser.choose(battle, [ agenda ])).to.eventually.be.null;
		});

		it('should return an agenda with score 0 if no others fit', function() {
			const agenda = new Agenda();
			sinon.stub(agenda, 'matches').returns([{}]);

			sinon.stub(chooser, 'scoreOf').returns(0);
			return expect(chooser.choose(battle, [ agenda ])).to.eventually.equal(agenda);
		});

		it('should return the agenda with the highest score', async function() {
			const agendas = [];
			const matchers = [];
			for (let i = 0; i < 3; i++) {
				const matcher = {};
				const agenda = new Agenda(matcher);
				agenda.id = i;
				agendas.push(agenda);
				matchers.push(matcher);
			}

			// Make each match's score its index
			sinon.stub(chooser, 'scoreOf');
			matchers.forEach((matcher, index) => chooser.scoreOf.withArgs(sinon.match.same(matcher)).returns(index)); // sinon.match.same: Use strict equality instead of deep equality for arg matching
			
			await expect(chooser.choose(battle, agendas)).to.eventually.equal(agendas.at(-1));
		});
	});
});