import PlayerProvider from '../../src/providers/playerprovider.js';
import Player from'../../src/model/player.js';
import { existsSync, readFileSync } from 'fs';
import chalk from 'chalk';
import dedent from 'dedent-js';

describe('PlayerProvider @end-to-end', function() {
	let applicationId;
	let playerProvider;

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
		playerProvider = new PlayerProvider(applicationId, 'eu');
	});

	describe('.getPlayers', function() {
		it('should get player data', async function() {
			let result = await playerProvider.getPlayers([ 'Wiochi', 'starboardwing' ]);
			expect(result).to.be.an('object')
			expect(result).to.have.property('Wiochi').that.is.an.instanceof(Player);
			expect(result.Wiochi.getBattles()).to.be.at.least(1);
			expect(result.Wiochi.getVictories()).to.be.at.least(1);
			expect(result).to.have.property('starboardwing').that.is.an.instanceof(Player);
			expect(result.starboardwing.getBattles()).to.be.at.least(1);
			expect(result.starboardwing.getVictories()).to.be.at.least(1);
		});
	});
});