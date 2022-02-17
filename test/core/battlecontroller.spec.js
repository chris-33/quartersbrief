import { BattleController } from '../../src/core/battlecontroller.js';
import { writeFileSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';

describe('BattleController', function() {
	const filepath = os.tmpdir();

	let battlecontroller;

	before(function() {
		battlecontroller = new BattleController(filepath);
	});

	afterEach(function() {
		deleteFile();
	});

	// Helper functions that create and delete a tempArenaInfo.json in the os's temp dir.
	// This is kind of (extremely) ugly, but the easiest way since mock-fs currently does not
	// support fs watching.
	// See https://github.com/tschaub/mock-fs/issues/246
	function createFile() {	writeFileSync(path.join(filepath, 'tempArenaInfo.json'), '{}'); }
	function deleteFile() { rmSync(path.join(filepath, 'tempArenaInfo.json'), { force: true /* Ignore if missing */}); }

	it('should emit a "battlestart" event when it detects creation or change of "tempArenaInfo.json"', function() {
		let p = expect(battlecontroller).to.emit('battlestart');
		createFile();
		return p;
	});

	it('should emit a "battleend" event when it detects removal of "tempArenaInfo.json"', function() {
		createFile();
		let p = expect(battlecontroller).to.emit('battleend');
		deleteFile();
		return p;		
	});
});