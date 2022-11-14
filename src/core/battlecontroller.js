import watch from 'node-watch';
import log from 'loglevel';
import { EventEmitter } from 'events';

/**
 * The `BattleController` watches the World of Warships replay directory for the existence of `tempArenaInfo.json`. When it detects
 * this file being created or changed, it emits a `battlestart` event. When it detects it being removed, it emits a `battleend` event.
 */
export default class BattleController extends EventEmitter {
	
	constructor (replaydir) {
		super();
		let self = this;

		let watcher = watch(replaydir, { persistent: false, recursive: false, filter: /tempArenaInfo.json/ });
		log.debug(`Watching folder ${replaydir} for tempArenaInfo.json`);
		watcher.on('change', function(evt) {
			if (evt === 'update') { // file created or modified
				log.debug('Detected battle start');
				self.emit('battlestart');
			} else if (evt === 'remove') { // file deleted
				log.debug('Detected battle end');
				self.emit('battleend');
			}
		});

		process.on('exit', function() { log.debug('Ending folder watch'); watcher.close(); });
	}
}