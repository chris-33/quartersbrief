import PlayerProvider from '../../src/providers/playerprovider.js';
import Player from'../../src/model/player.js';
import sinon from 'sinon';
import nock from 'nock';

describe('PlayerProvider @integration', function() {
	let provider;

	const p1 = { account_id: 1, nickname: 'player1' };
	const p2 = { account_id: 2, nickname: 'player2' };

	before(function() {
		nock.disableNetConnect();
	});

	after(function() {
		nock.enableNetConnect();
	});

	beforeEach(function() {
		provider = new PlayerProvider('appid', 'eu');
	});

	beforeEach(function() {
		nock.cleanAll();
	});

	it('should get player data from Wargaming\'s online API', async function() {
		const request1 = nock(/worldofwarships/).get(/account\/list/).reply(200, {
			status: 'ok',
			meta: { count: 2 },
			data: [ p1, p2 ]
		});
		const request2 = nock(/worldofwarships/).get(/account\/info/).reply(200, {
			status: 'ok',
			meta: { count: 2 },
			data: {
				[p1.account_id]: p1,
				[p2.account_id]: p2
			}
		});
		let result = await provider.getPlayers([ p1.nickname, p2.nickname ]);
		expect(request1).to.have.been.requested;
		expect(request2).to.have.been.requested;

		expect(result).to.be.an('object')
		expect(result).to.have.property(p1.nickname).that.is.an.instanceof(Player);
		expect(result[p1.nickname]).to.have.property('_data').that.deep.equals(p1);
		expect(result).to.have.property(p2.nickname).that.is.an.instanceof(Player);
		expect(result[p2.nickname]).to.have.property('_data').that.deep.equals(p2);
	});

	it('should bundle all requested players into a single network call to Wargaming\'s online API', async function() {
		nock(/worldofwarships/).get(/account\/list/).once().reply(200, {
			status: 'ok',
			meta: { count: 2 },
			data: [ p1, p2 ]
		});
		nock(/worldofwarships/).get(/account\/info/).once().reply(200, {
			status: 'ok',
			meta: { count: 2 },
			data: {
				[p1.account_id]: p1,
				[p2.account_id]: p2
			}
		});

		const result = provider.getPlayers([ p1.nickname, p2.nickname ]);
		// Check that there were not more requests than one.
		// If there were additional requests, they will produce an error from nock
		await expect(result, 'There were more requests than expected').to.not.be.rejected;
		// Check that there are no pending requests, either
		expect(nock.isDone(), 'There were less requests than expected').to.be.true;
	});

	it('should be able to handle players that were requested but are not part of the response', async function() {
		nock(/worldofwarships/).get(/account\/list/).reply(200, {
			status: 'ok',
			meta: { count: 2 },
			data: [ p1, p2 ]
		});
		nock(/worldofwarships/).get(/account\/info/).reply(200, {
			status: 'ok',
			meta: { count: 1 },
			data: {
				[p1.account_id]: p1,
				[p2.account_id]: null
			}
		});
		let result = provider.getPlayers([ p1.nickname, p2.nickname ]);

		await expect(result).to.be.fulfilled;
		result = await result;
		expect(result).to.be.an('object')
		expect(result).to.have.property(p1.nickname).that.is.an.instanceof(Player);
		expect(result[p1.nickname]).to.have.property('_data').that.deep.equals(p1);
		expect(result).to.not.have.property(p2.nickname);
	});

	it('should not hit Wargaming\'s online API for bots', async function() {
		// Set up no nock interceptors here
		// If the PlayerProvider does make a network request, this will show in a rejected promise from nock
		
		// Check that there were not more requests than one.
		// If there were additional requests, they will produce an error from nock		
		return expect(provider.getPlayers([ ':Bot:' ]), 'PlayerProvider made a network request').to.not.be.rejected;
	});

	it('should not hit Wargaming\'s online API for a subsequent request within the time-to-live', async function() {
		const clock = sinon.useFakeTimers();
		try {
			nock(/worldofwarships/).get(/account\/list/).once().reply(200, {
				status: 'ok',
				meta: { count: 2 },
				data: [ p1, p2 ]
			});
			nock(/worldofwarships/).get(/account\/info/).once().reply(200, {
				status: 'ok',
				meta: { count: 2 },
				data: {
					[p1.account_id]: p1,
					[p2.account_id]: p2
				}
			});

			const first = await provider.getPlayers([ p1.nickname, p2.nickname ]);
			// Make sure the second call happens within the TTL:
			clock.tick(1);
			const second = provider.getPlayers([ p1.nickname, p2.nickname ]);

			await expect(second, 'There was a second request to the server').to.not.be.rejected;
			expect(nock.isDone(), 'There were less requests than expected').to.be.true;

			return expect(second).to.eventually.deep.equal(first);
		} finally {
			clock.restore();
		}
	})
});