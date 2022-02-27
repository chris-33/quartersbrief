import { Agenda } from '../../src/briefing/agenda.js';
import { Battle } from '../../src/model/battle.js';
import { Ship } from '../../src/model/ship.js';
import sinon from 'sinon';

describe('Agenda', function() {
	describe('.score', function() {
		it('should calculate scores according to ships, classes, nations and tiers', function() {
			expect(new Agenda(null, null).score).to.equal(undefined);
			expect(new Agenda({}, null).score).to.equal(0);
			expect(new Agenda({ ships: [] }, null).score).to.equal(100);
			expect(new Agenda({ tiers: [ 8, 9, 10 ], classes: [ 'Cruiser' ]}, null).score).to.equal(20);			
		});
	});

	describe('.matches', function() {
		let battle;

		beforeEach(function() {
			battle = new Battle();
			let ship = new Ship({
				level: 8,
				name: 'PAAA001_Battleship',
				typeinfo: { type: 'Ship', nation: 'USA', species: 'Battleship' },
				ShipUpgradeInfo: {},
				ShipAbilities: []
			});
			sinon.stub(battle, 'getPlayer').returns({ship: ship});
		});

		it('should throw if the battle does not have a ship for the player', function() {
			let agenda = new Agenda({}, null);
			// Expect to throw if getPlayer() does not have a 'ship' property
			battle.getPlayer.returns({});
			expect(agenda.matches.bind(agenda, battle)).to.throw();
			// Expect to throw if getPlayer() does have a 'ship' property but it is not a 'Ship'
			battle.getPlayer.returns({ ship: {} });
			expect(agenda.matches.bind(agenda, battle)).to.throw();
			// Expect to not throw if getPlayer() does have a 'ship' property that is a 'Ship'
			battle.getPlayer.returns({ ship: sinon.createStubInstance(Ship) });
			expect(agenda.matches.bind(agenda, battle)).to.not.throw();
		});

		it('should match a battle only if it fulfills all listed criteria', function() {
			expect(new Agenda({ ships: [ 'PAAA002_SomethingElse' ] }, null).matches(battle)).to.be.false; // Wrong name
			expect(new Agenda({ ships: [ 'PAAA001_Battleship' ] }, null).matches(battle)).to.be.true;
			expect(new Agenda({}, null).matches(battle)).to.be.true;
			expect(new Agenda({ ships: [ 'PAAA001_Battleship' ], tiers: [ 7 ] }, null).matches(battle)).to.be.false; // Wrong tier
			expect(new Agenda({ classes: [ 'Battleship', 'Cruiser' ] }, null).matches(battle)).to.be.true;
			expect(new Agenda({ classes: [ 'Battleship', 'Cruiser' ], tiers: [ 8, 9, 10 ] }, null).matches(battle)).to.be.true;
			expect(new Agenda({ classes: [ 'Battleship', 'Cruiser' ], tiers: [ 8, 9, 10 ], nations: [ 'Germany' ] }, null).matches(battle)).to.be.false; // Wrong nation
			expect(new Agenda({ classes: [ 'Battleship', 'Cruiser' ], tiers: [ 8, 9, 10 ], nations: [ 'Germany', 'USA' ] }, null).matches(battle)).to.be.true;
		});
	});

	describe('.getTopicNames', function() {
		it('should return the names of all topics of the agenda', function() {
			expect(new Agenda(null, {
				topic1: {},
				topic2: {}
			}).getTopicNames()).to.be.an('array').with.members([ 'topic1', 'topic2' ]);
		});

		it('should have topic data for all returned topic names', function() {
			let agenda = new Agenda(null, {
				topic1: { prop: 'prop' },
				topic2: { prop: 'prop' }
			});
			agenda.getTopicNames().forEach(topic => expect(agenda.topics[topic]).to.have.property('prop'));
		});
	});
});
