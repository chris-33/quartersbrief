import path from 'path';
import esmock from 'esmock';
import EventEmitter from 'events';

describe('BattleController', function() {
	const filepath = '/replays';
	const emitter = new class extends EventEmitter {
		// node-watch (the library BattleController uses for fs watching) expects the returned
		// object to have this method.
		close() {}
	}();

	let BattleController;
	let battlecontroller;

	before(async function() {
		// Mock the file-watching event emitter so we can simulate addition and removal of tempArenaInfo.json
		BattleController = (await esmock('../../src/core/battlecontroller.js', {
			'node-watch': () => emitter			
		})).default;
	});

	beforeEach(function() {
		battlecontroller = new BattleController(filepath);
	});

	// Helper functions that simulate creation and deletion of tempArenaInfo.json by manually emitting
	// the appropriate events, because mock-fs currently does not support fs watching.
	// See https://github.com/tschaub/mock-fs/issues/246
	function createFile() { emitter.emit('change', 'update', path.join(filepath,'tempArenaInfo.json')); }
	function deleteFile() { emitter.emit('change', 'remove', path.join(filepath, 'tempArenaInfo.json')); }

	it('should emit a "battlestart" event when it detects creation or change of "tempArenaInfo.json"', function() {
		let p = expect(battlecontroller).to.emit('battlestart');
		createFile();
		return p;
	});

	it('should emit a "battleend" event when it detects removal of "tempArenaInfo.json"', function() {
		let p = expect(battlecontroller).to.emit('battleend');
		deleteFile();
		return p;		
	});
});