import Player from '../../src/model/player.js';

describe('Player', function() {
	const statistics = [ 'battles', 'victories', 'winrate' ];

	describe('.winrate', function() {
		it('should be 0 if the player has not fought any battles and the ratio of wins to fought battles otherwise', function() {
			expect(new Player({ statistics: { pvp: { wins: 0, battles: 0 }}}).winrate).to.equal(0);
			for (let i = 1; i < 6; i++) {
				expect(new Player({ statistics: { pvp: { wins: 1, battles: i }}}).winrate).to.equal(1 / i);
			}
		});

		it('should return undefined for all statistics for a hidden profile', function() {
			let player = new Player({ hidden_profile: true });
			for (let prop of statistics)
				expect(player[prop], prop).to.be.undefined;
		});
	});

	describe('Player.createBot', function() {
		const name = ':Bot:';
		let bot;
		beforeEach(function() {
			bot = Player.createBot(name);
		});

		it('should have a bot flag', function() {
			expect(bot.bot).to.be.true;
		});
		
		it('should have a name', function() {
			expect(bot.name).to.equal(name);
		});

		it('should return NaN for all statistics', function() {
			for (let prop of statistics)
				expect(bot[prop], prop).to.be.NaN;
		});
	});
});