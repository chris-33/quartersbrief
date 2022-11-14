import mockfs from 'mock-fs';
import BattleDataReader from '../../src/core/battledatareader.js';
import Battle from '../../src/model/battle.js';

describe('.BattleDataReader', function() {
	const replaydir = '/replays';

	let battleDataReader;
	
	beforeEach(function() {
		battleDataReader = new BattleDataReader(replaydir);
	});

	afterEach(function() {
		mockfs.restore();
	});

	it('should throw if constructed without a replaydir', function() {
		expect(() => new BattleDataReader()).to.throw();
	});

	it('should return a battle over the file contents', async function() {
		const battleData = {
			n: 5
		}
		mockfs({ [replaydir]: { 'tempArenaInfo.json': JSON.stringify(battleData) }});
		const battle = await battleDataReader.read();
		expect(battle).to.be.an.instanceof(Battle);
		expect(battle._data).to.deep.equal(battleData);
	});

	it('should return null if there is no tempArenaInfo', function() {
		mockfs({ [replaydir]: {} });
		return expect(battleDataReader.read()).to.eventually.be.null;
	});

	it('should recover from missing permissions and return null', function() {
		mockfs({ [replaydir]: {
			'tempArenaInfo.json': mockfs.file({
				mode: 0 // No one has any permissions whatsoever
			})
		}});
		return expect(battleDataReader.read()).to.eventually.be.null;
	});
});
