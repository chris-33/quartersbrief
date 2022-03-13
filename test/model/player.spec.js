import { Player } from '../../src/model/player.js';

describe('Player', function() {
	describe('.winrate', function() {
		it('should be 0 if the player has not fought any battles and the ratio of wins to fought battles otherwise', function() {
			expect(new Player({ statistics: { pvp: { wins: 0, battles: 0 }}}).winrate).to.equal(0);
			for (let i = 1; i < 6; i++) {
				expect(new Player({ statistics: { pvp: { wins: 1, battles: i }}}).winrate).to.equal(1 / i);
			}
		});
	});
})