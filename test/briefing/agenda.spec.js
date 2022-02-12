import { Agenda } from '../../src/briefing/agenda.js';
import { Ship } from '../../src/model/ship.js';

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
		let ship;
		beforeEach(function() {
			ship = new Ship({ ShipUpgradeInfo: {}, level: 8, name: 'PAAA001_Battleship', typeinfo: { species: 'Battleship', nation: 'USA', type: 'Ship'}});
		});

		it('should match a ship only if it fulfills all listed criteria', function() {
			expect(new Agenda({ ships: [ 'PAAA001_Battleship' ] }, null).matches(ship)).to.be.true;
			expect(new Agenda({}, null).matches(ship)).to.be.true;
			expect(new Agenda({ ships: [ 'PAAA001_Battleship' ], tiers: [ 7 ] }, null).matches(ship)).to.be.false; // Wrong tier
			expect(new Agenda({ classes: [ 'Battleship', 'Cruiser' ] }, null).matches(ship)).to.be.true;
			expect(new Agenda({ classes: [ 'Battleship', 'Cruiser' ], tiers: [ 8, 9, 10 ] }, null).matches(ship)).to.be.true;
			expect(new Agenda({ classes: [ 'Battleship', 'Cruiser' ], tiers: [ 8, 9, 10 ], nations: [ 'Germany' ] }, null).matches(ship)).to.be.false;
			expect(new Agenda({ classes: [ 'Battleship', 'Cruiser' ], tiers: [ 8, 9, 10 ], nations: [ 'Germany', 'USA' ] }, null).matches(ship)).to.be.true;
		});
	});
});
