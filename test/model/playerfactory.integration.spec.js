import { PlayerFactory } from '../../src/model/playerfactory.js';
import { Player } from'../../src/model/player.js';
import { existsSync, readFileSync } from 'fs';
import chalk from 'chalk';
import dedent from 'dedent-js';

describe('PlayerFactory @integration', function() {
	let applicationId;
	let playerFactory;

	before(function() {
		applicationId = 
			process.argv.find(arg => arg.toUpperCase().startsWith('--APPLICATION_ID'))?.split('=')?.[1]
			?? process.env.WG_APPLICATION_ID 
			?? (existsSync('wg-application-id.secret') && readFileSync('wg-application-id.secret', 'utf-8'));

		if (!applicationId) {
			console.log(chalk.yellow(dedent`
			Could not find Wargaming API key (APPLICATION_ID). Skipping this test suite. You can provide it using
			1. Putting it in a file called wg-application-id.secret in the current working directory. (Make sure not to commit this file to version control!)
			2. Setting the environment variable WG_APPLICATION_ID
			3. Passing it as an additional option Mocha like --application_id=<applicationid>. (For npm test, add a double hyphen before, like npm test -- --application_id=<applicationid>)`));
			this.skip();
		}
	});

	beforeEach(function() {
		playerFactory = new PlayerFactory(applicationId, 'eu');
	});

	describe('.getAccountIDs', function() {
		it('should get account IDs for all requested names', async function() {
			const expected = {
				Wiochi: 503367319,
				starboardwing: 563562880
			};
			return expect(playerFactory.getAccounts([ 'Wiochi', 'starboardwing' ])).to.eventually.deep.equal(expected);
		});
	});

	describe('.getPlayers', function() {
		it('should get player data', async function() {
			let result = await playerFactory.getPlayers([ 'Wiochi', 'starboardwing' ]);
			expect(result).to.be.an('object')
			expect(result).to.have.property('Wiochi').that.is.an.instanceof(Player);
			expect(result.Wiochi.battles).to.be.at.least(1);
			expect(result.Wiochi.victories).to.be.at.least(1);
			expect(result).to.have.property('starboardwing').that.is.an.instanceof(Player);
			expect(result.starboardwing.battles).to.be.at.least(1);
			expect(result.starboardwing.victories).to.be.at.least(1);
		});
	});
});