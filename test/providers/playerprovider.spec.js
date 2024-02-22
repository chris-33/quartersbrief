import PlayerProvider from '../../src/providers/playerprovider.js';
import Player from '../../src/model/player.js';
import sinon from 'sinon';

describe('PlayerProvider', function() {
	let provider;

	beforeEach(function() {
		provider = new PlayerProvider('appid', 'realm');
	});

	describe('PlayerProvider.PlayerSupplier.Request', function() {
		let api;
		let request;

		beforeEach(function() {
			api = {
				access: sinon.stub().resolves([])
			}
			request = new PlayerProvider.PlayerSupplier.Request(api);
		});

		it('should request all previously added accounts when executing', async function() {
			const designator1 = 1;
			const designator2 = 2;

			request.add(designator1);
			request.add(designator2);

			await request.execute();

			expect(api.access).to.have.been.calledWith(sinon.match.any, sinon.match.has('account_id', [ designator1, designator2 ]));
		});

		it('should not hit the API when adding', async function() {
			const designator1 = 1;
			const designator2 = 2;

			request.add(designator1);
			request.add(designator2);

			expect(api.access).to.not.have.been.called;
		});

		it('should hit the API when executing', async function() {
			const designator1 = 1;
			const designator2 = 2;

			request.add(designator1);
			request.add(designator2);

			await request.execute();

			expect(api.access).to.have.been.called;
		});

		it('should not hit the API if nothing has been added', async function() {
			await request.execute();

			expect(api.access).to.not.have.been.called;
		});

		it('should resolve add() to its individual result', async function() {
			const p1 = { account_id: 1, nickname: 'designator1' };
			const p2 = { account_id: 2, nickname: 'designator2' };
			api.access
				.withArgs(sinon.match(arg => arg.toLowerCase() === 'players.list'))
				.resolves([ p1, p2 ])
				.withArgs(sinon.match(arg => arg.toLowerCase() === 'players.data'))
				.resolves({
					[p1.account_id]: p1,
					[p2.account_id]: p2
				});

			const designator1 = 'designator1';
			const designator2 = 'designator2';

			const result1 = request.add(designator1);
			const result2 = request.add(designator2);

			await request.execute();

			expect(await result1).to.deep.equal(p1);
			expect(await result2).to.deep.equal(p2);
		});

		it('should translate string designators to account ids', async function() {
			const API_OP_TRANSLATE_MATCHER = sinon.match(arg => arg.toLowerCase() === 'players.list');

			const p1 = { account_id: 1, nickname: 'designator1' };
			const p2 = { account_id: 2, nickname: 'designator2' };

			api.access
				.withArgs(API_OP_TRANSLATE_MATCHER)
				.resolves([ p1 ]);

			request.add(p1.nickname);
			request.add(p2.account_id);

			await request.execute();
			
			expect(api.access).to.have.been.calledWith(API_OP_TRANSLATE_MATCHER, sinon.match.has('search', [ p1.nickname ]));
		});

		it('should reject add() when execute() fails', function() {
			const reason = new Error();
			api.access.rejects(reason);

			const designator = 'designator';
			
			const result = request.add(designator);		
			request.execute();
			
			return expect(result).to.be.rejectedWith(reason);
		});

		it('should resolve execute() to a hash of the complete result', function() {
			const p1 = { account_id: 1, nickname: 'designator1' };
			const p2 = { account_id: 2, nickname: 'designator2' };
			api.access
				.withArgs(sinon.match(arg => arg.toLowerCase() === 'players.list'))
				.resolves([ p1, p2 ])
				.withArgs(sinon.match(arg => arg.toLowerCase() === 'players.data'))
				.resolves({
					[p1.account_id]: p1,
					[p2.account_id]: p2
				});

			const designator1 = 'designator1';
			const designator2 = 'designator2';

			request.add(designator1);
			request.add(designator2);

			return expect(request.execute()).to.eventually.deep.equal({
				[p1.nickname]: p1,
				[p2.nickname]: p2
			});
		});

		it('should reject execute() when the api errors', function() {
			const reason = new Error();
			api.access.rejects(reason);

			const designator = 'designator';
			
			request.add(designator);		
			
			return expect(request.execute()).to.be.rejectedWith(reason);
		});

		it('should error if adding more designators to an already-executed request', async function() {
			const designator1 = 'designator1';
			const designator2 = 'designator2';

			request.add(designator1);
			request.execute();

			return expect(request.add(designator2)).to.be.rejectedWith(/execute/);
		});
	});

	describe('PlayerProvider.PlayerSupplier', function() {
		let supplier;
		let api;

		beforeEach(function() {
			api = {
				access: sinon.stub()
			}
			supplier = new PlayerProvider.PlayerSupplier(api);
		});

		describe('cache item validation', function() {			
			beforeEach(function() {
				this.clock = sinon.useFakeTimers();
			});

			afterEach(function() {
				this.clock.restore();
			});

			it('should consider an item without timestamp invalid', function() {
				const p = Promise.resolve();
				expect(supplier.validate(p)).to.be.false;
			});

			it('should consider an item valid if its timestamp is not older than the time-to-live', function() {
				const p = Promise.resolve();
				p.timestamp = Date.now();
				expect(supplier.validate(p)).to.be.true;

				this.clock.tick(PlayerProvider.PlayerSupplier.TTL);
				expect(supplier.validate(p)).to.be.true;

				this.clock.tick(1);
				expect(supplier.validate(p)).to.be.false;
			});
		});

		describe('recovery', function() {
			it('should attach a timestamp to the returned promise', function() {
				const request = new PlayerProvider.PlayerSupplier.Request();
				const p = supplier.recover(request, 'designator');
				expect(p).to.have.property('timestamp');
			});

			it('should add the designator to recover to the request', function() {
				const request = new PlayerProvider.PlayerSupplier.Request();
				sinon.spy(request, 'add');
				const designator = 'designator';
				supplier.recover(request, designator);
				
				expect(request.add).to.have.been.calledWith(designator);
			});
		});
	});

	describe('getPlayers', function() {
		const p1 = { account_id: 1, nickname: 'player1' };
		const p2 = { account_id: 2, nickname: 'player2' };

		beforeEach(function() {
			sinon.stub(PlayerProvider.PlayerSupplier.Request.prototype, 'execute').resolves();
			sinon.stub(provider.supplier, 'get')
				.onFirstCall().resolves(p1)
				.onSecondCall().resolves(p2);
		});

		afterEach(function() {
			PlayerProvider.PlayerSupplier.Request.prototype.execute.restore();
		});

		it('should return instances of Player over the correct data', async function() {			
			let result = await provider.getPlayers([ 1, 2 ]);

			expect(result).to.be.an('object');
			expect(result).to.have.property('player1').that.is.an.instanceof(Player);			
			expect(result).to.have.property('player2').that.is.an.instanceof(Player);
			expect(result.player1).to.have.property('_data').that.deep.equals(p1);
			expect(result.player2).to.have.property('_data').that.deep.equals(p2);
		});

		it('should ignore requested players that are not part of the result', async function() {
			provider.supplier.get.onSecondCall().resolves(undefined);

			let result = provider.getPlayers([ 1, 2 ]);

			await expect(result, 'missing player data should not crash getPlayers()').to.be.fulfilled;
			expect(Object.keys(await result)).to.deep.equal([ 'player1' ]);
		});

		it('should return instances of Player for bots', async function() {
			let result = await provider.getPlayers([ ':Bot:' ]);

			expect(result).to.be.an('object')
			expect(result).to.have.property(':Bot:').that.is.an.instanceof(Player);
			expect(result[':Bot:']).to.have.property('bot').that.is.true;
		});
	});
});