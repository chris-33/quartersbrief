import { PlayerFactory } from '../../src/model/playerfactory.js';
import { Player } from '../../src/model/player.js';
import sinon from 'sinon';
import nock from 'nock';

describe('PlayerFactory', function() {
	let playerFactory;
	let srv;

	before(function() {
		srv = nock(/worldofwarships/);
		nock.disableNetConnect();
	});

	beforeEach(function() {
		nock.cleanAll();
		playerFactory = new PlayerFactory('', '');
	});

	after(function() {
		nock.enableNetConnect();		
	});

	describe('.getAccountIDs', function() {
		it('should get account IDs for all requested names', async function() {
			srv.get(/account\/list/).reply(200, {
				status: 'ok',
				meta: { count: 1 },
				data: [				
					{ account_id: 1, nickname: 'player1' },
					{ account_id: 2, nickname: 'player2' }
				]				
			});
			const expected = {
				player1: 1,
				player2: 2
			};
			return expect(playerFactory.getAccounts([ 'player1', 'player2' ])).to.eventually.deep.equal(expected);
		});
	});

	describe('.getPlayers', function() {
		beforeEach(function() {
			sinon.stub(playerFactory, 'getAccounts').resolves({
				player1: 1,
				player2: 2
			});
		});

		afterEach(function() {
			playerFactory.getAccounts.restore();
		});

		it('should translate player names into account IDs when necessary', async function() {
			srv.get(/account\/info/).times(3).reply(200, {});

			await playerFactory.getPlayers(['player1, player2']);
			expect(playerFactory.getAccounts, 'names').to.have.been.calledOnceWith(['player1, player2']);
			playerFactory.getAccounts.resetHistory();

			await playerFactory.getPlayers([1,2]);
			expect(playerFactory.getAccounts, 'account IDs').to.not.have.been.called;

			await playerFactory.getPlayers([1, 'player2']);
			expect(playerFactory.getAccounts, 'mixed names and account IDs').to.have.been.calledWith(['player2']);
		});

		it('should return instances of Player over the correct data', async function() {
			const data = {
				1: { account_id: 1, nickname: 'player1' },
				2: { account_id: 2, nickname: 'player2' }
			}
			srv.get(/account\/info/).reply(200, {
				status: 'ok',
				meta: { count: 2, hidden: null },
				data
			});
			let result = await playerFactory.getPlayers([ 1, 2 ]);
			expect(result).to.be.an('object')
			expect(result).to.have.property('player1').that.is.an.instanceof(Player);			
			expect(result).to.have.property('player2').that.is.an.instanceof(Player);
			expect(result.player1).to.have.property('_data').that.deep.equals(data[1]);
			expect(result.player2).to.have.property('_data').that.deep.equals(data[2]);
		});
	});
});