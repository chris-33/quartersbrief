import watch from 'node-watch';
import log from 'loglevel';
import { readFile } from 'fs/promises';
import { EventEmitter } from 'events';
import path from 'path';

/**
 * The `BattleController` watches the World of Warships replay directory for the existence of `tempArenaInfo.json`. When it detects
 * this file being created or changed, it emits a `battlestart` event. When it detects it being removed, it emits a `battleend` event.
 */
class BattleController extends EventEmitter {
	
	constructor (replaydir) {
		super();
		let self = this;

		let watcher = watch(replaydir, { persistent: false, recursive: false, filter: /tempArenaInfo.json/ });
		watcher.on('change', async function(evt, name) {
			if (evt === 'update') { // file created or modified
				log.info('Detected new battle');
				let battle = JSON.parse(await readFile(path.join(replaydir, 'tempArenaInfo.json')));
				self.emit('battlestart', battle);
			} else if (evt === 'remove') { // file deleted
				self.emit('battleend');
			}
		});

		process.on('exit', function() { watcher.close(); });
	}
}

export { BattleController }