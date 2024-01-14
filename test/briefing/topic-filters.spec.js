import * as filters from '../../src/briefing/topic-filters.js';

describe('topic-filters', function() {

	const CLASSES = [ 'AirCarrier', 'Battleship', 'Cruiser', 'Destroyer', 'Submarine' ];

	describe('duplicates', function() {
		it('should have every id exactly once that was present in the original', function() {
			const ids = [ 1, 1, 2, 2, 2, 3 ];

			expect(ids.filter(filters.duplicates)).to.deep.equal(Array.from(new Set(ids)))
		});
	});

	describe('teams', function() {
		let teams;
		let ids;

		beforeEach(function() {
			teams = {
				player: 0,
				allies: [ 1, 2, 3 ],
				enemies: [ 11, 12, 13 ]
			};
			ids = Object.values(teams).flat();
		});

		it('should return a function', function() {
			expect(filters.teams()).to.be.a('function');
		});

		it('should let everything pass when show is ommitted or empty', function() {
			[ 
				undefined,
				[]
			].forEach(show => expect(ids.filter(filters.teams(teams, show)), show).to.deep.equal(ids));
		});

		it('should let only ids present in the teams to show pass', function() {
			const expected = {
				...teams,
				player: [ teams.player ]
			};

			[
				'player',
				'allies',
				'enemies',
			].forEach(team => 
				expect(ids.filter(filters.teams(teams, [ team ])), `[${team}]`).to.deep.equal(expected[team])
			)

			expect(ids.filter(filters.teams(teams, ['allies', 'enemies'])), `['allies','enemies']`).to.deep.equal(expected.allies.concat(expected.enemies));
		});

		it('should let an id pass if it is in a team to show, even if it is also present in a team to hide', function() {
			const inBoth = teams.allies[0];
			teams.enemies.push(inBoth);
			expect(ids.filter(filters.teams(teams, ['enemies']))).to.include(inBoth);
		});
	});

	describe('classes', function() {
		let ships;

		beforeEach(function() {
			ships = CLASSES.map(cls => ({ class: cls }));
		});

		it('should return a function', function() {
			expect(filters.classes()).to.be.a('function');
		});

		it('should let everything pass when show is ommitted or empty', function() {
			[
				undefined,
				[]
			].forEach(show => expect(ships.filter(filters.classes(show)), show).to.deep.equal(ships));
		});

		it('should let only ships pass that are of one of the classes to show', function() {
			const show = [ CLASSES[1], CLASSES[2] ];
			const hide = CLASSES.filter(cls => !show.includes(cls));
			let result = ships.filter(filters.classes(show));
			
			expect(result).to.be.an('array');
			expect(result).to.each.satisfy(ship => show.includes(ship.class));
			expect(result).to.each.satisfy(ship => !hide.includes(ship.class));
		});
	});

	describe('loadScreenSort', function() {
		let ships;
		const tiers = [ 1, 2 ];
		const nations = [ 'A', 'B' ];

		beforeEach(function() {			
			ships = CLASSES.flatMap(
				cls => tiers.flatMap(
				tier => nations.flatMap(
				nation => ({
					class: cls,
					tier,
					refcode: `P${nation}AA`
				}))));
		});

		it('should sort by classes', function() {
			let result = ships.sort(filters.loadScreenSort);
			result.forEach((ship, index) => {
				let before = result.slice(0, index);
				let after = result.slice(index + 1);
			
				expect(before).to.each.satisfy(other => CLASSES.indexOf(other.class) <= CLASSES.indexOf(ship.class));
				expect(after).to.each.satisfy(other => CLASSES.indexOf(other.class) >= CLASSES.indexOf(ship.class));
			});
		});

		it('should sort by tier within each class', function() {
			let result = ships.sort(filters.loadScreenSort);
			CLASSES.forEach(cls => {
				let byClass = result.filter(ship => ship.class === cls);
				byClass.forEach((ship, index) => {
					let before = byClass.slice(0, index);
					let after = byClass.slice(index + 1);
				
					expect(before).to.each.satisfy(other => other.tier >= ship.tier);
					expect(after).to.each.satisfy(other => other.tier <= ship.tier);
				});
			});
		});

		it('should sort by nation within each tier and class', function() {
			let result = ships.sort(filters.loadScreenSort);
			CLASSES.forEach(cls => tiers.forEach(tier => {
				let byClassAndTier = result.filter(ship => ship.class === cls && ship.tier === tier);
				byClassAndTier.forEach((ship, index) => {
					let before = byClassAndTier.slice(0, index);
					let after = byClassAndTier.slice(index + 1);
				
					expect(before).to.each.satisfy(other => other.refcode[1] <= ship.refcode[1]);
					expect(after).to.each.satisfy(other => other.refcode[1] >= ship.refcode[1]);
				});
			}));
		});
	});
});
