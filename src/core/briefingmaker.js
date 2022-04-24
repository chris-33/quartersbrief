import { BriefingBuilder } from '../briefing/briefingbuilder.js';
import { Battle } from '../model/battle.js';
import { readFile } from 'fs/promises';
import log from 'loglevel';
import path from 'path';

/**
 * Helper class to read 'tempArenaInfo.json' from the World of Warship replays directory and parse it to an object.
 * It can recover from `ENOENT` errors (meaning the file or the directory isn't there) and `EACCES` errors (meaning
 * the file or the replays directory have insufficient permissions).
 */
class BattleDataReader {
	constructor(replaydir) {
		this.replaydir = replaydir;
	}

	/**
	 * Attempt to read `tempArenaInfo.json` and return its contents.
	 * @return {Object} The contents of `tempArenaInfo.json`, or `null` if the file doesn't exist, the watched directory
	 * doesn't exist, or either one has insufficient permissions for reading.
	 */
	async read() {
		try {
			return JSON.parse(await readFile(path.join(this.replaydir, 'tempArenaInfo.json')));
		} catch (err) {
			switch (err.code) {
				case 'ENOENT':
					// This means either there is currently no battle, or the provided path was wrong
					// The most likely cause is there is no battle, so this is not entirely unexpected behavior.
					// We will return null and let the main algorithm figure out where to go from here.
					// But in case the path was wrong, also put a line in the log
					log.debug(`No battle found when reading ${this.replaydir}`);
					return null;
				case 'EACCES': 
					// Permission denied. This is not recoverable for quartersbrief, put an error in the log
					log.error(`Permission denied when trying to read from ${this.replaydir}`);
					return null;
				default:
					throw err;
			}
		}		
	}
}

/**
 * Decorates {@link AgendaStore} to recover `ENOENT` (agendas directory does not exist) and `EACCES` (agendas directory's
 * permissions do not allow reading) errors when trying to read agendas.
 */
class ErrorHandlingAgendaStore {
	constructor(agendaStore) {
		this.agendaStore = agendaStore;
	}

	/**
	 * Wraps {@link AgendaStore#getAgendas} to recover from `ENOENT` and `EACCESS` errors.
	 * @return {Agenda[]} The results of the wrapped call to `AgendaStore.getAgendas`, or an empty array if the above errors occurred.
	 */
	async getAgendas() {
		try {
			return await this.agendaStore.getAgendas();
		} catch (err) {
			switch (err.code) {
				case 'ENOENT':
					// The directory to read agendas from does not exist
					log.error(`Could not read agendas from ${this.agendaStore.agendadir}. The directory does not exist`);
					return [];
				case 'EACCES': {
					// Permission denied.
					log.error(`Permission denied when trying to read agendas from ${this.agendaStore.agendadir}`);
					return [];
				}
				default:
					throw err;
			}
		}		
	}
}

/**
 * `BriefingMaker` encapsulates the algorithm to make a briefing, using `BattleDataReader`, `AgendaStore` (or, more specifically,
 * `ErrorHandlingAgendaStore`) and `BriefingBuilder`. 
 *
 * In broad terms, this works as follows:
 * When the `BriefingMaker` is told to make a new briefing, it will look for the file `tempArenaInfo.json` in the World of Warships
 * replay directory. If it finds such a file, it will read the battle data from it and enrich it with `Ship` objects for all 
 * participating player, using its `GameObjectFactory` to do so. 
 *
 * It will then request all known `Agenda`s from its `AgendaStore` (generally, the `AgendaStore` will do this by reading all agenda
 * definitions from the quartersbrief agenda directory, but this is, of course, up to the `AgendaStore` implementation). Among these,
 * the agenda to use is chosen using the provided `strategy`. 
 *
 * Finally, a briefing is built using a `BriefingBuilder` on the battle and agenda. (See there for details on how the agenda's topics 
 * are processed and turned into briefing content.)
 * @see GameObjectFactory
 * @see AgendaStore
 * @see SpecificityStrategy
 * @see BriefingBuilder
 */
class BriefingMaker {
	/**
	 * Creates a new `BriefingMaker`.
	 * @param  {String} replaydir         The path where `tempArenaInfo.json` can be found.
	 * @param  {GameObjectFactory} gameObjectFactory A ´GameObjectFactory` instance to use for retrieving game objects, such as ships.
	 * @param  {AgendaStore} agendaStore       An `AgendaStore` instance that will provide the known agendas.
	 * @param  {Object} strategy          A strategy to use for choosing the agenda to use. Must have a `chooseAgenda` method.
	 */
	constructor(replaydir, gameObjectFactory, agendaStore, strategy) {
		this.battleDataReader = new BattleDataReader(replaydir);
		this.gameObjectFactory = gameObjectFactory;
		this.errorHandlingAgendaStore = new ErrorHandlingAgendaStore(agendaStore);
		this.strategy = strategy;
		this.briefingBuilder = new BriefingBuilder(this.gameObjectFactory);
	}

	/**
	 * Makes a briefing for the battle currently underway, as per `tempArenaInfo.json` in the World of Warships replays directory.
	 * This involves the following steps:
	 * 
	 * 1. The current battle's data is read from `tempArenaInfo.json` using a `BattleDataReader`.
	 * 2. The battle is enriched by adding `Ship` objects for all participants.
	 * 3. An agenda is chosen for the briefing, using `this.strategy`.
	 * 4. A briefing is built using a `BriefingBuilder`.
	 * 
	 * If there is no battle currently, the special template `no-battle.pug` is rendered and returned.
	 * If there is no agenda that matches the battle, the special template `no-agenda.pug` is rendered and returned.
	 * @return {Object} An object with two string properties `html` and `css` containing the complete HTML and CSS for the briefing, respectively.
	 */
	async makeBriefing() {
		let t0 = Date.now();

		let battle = await this.battleDataReader.read();
		if (battle === null) {
			return BriefingBuilder.buildNoBattle();
		}
		battle = new Battle(battle);
		let agendas = await this.errorHandlingAgendaStore.getAgendas();
		let agenda = this.strategy.chooseAgenda(battle, agendas);
		if (agenda === null) {
			return BriefingBuilder.buildNoAgenda();
		}
		let briefing = await this.briefingBuilder.build(battle, agenda);
		log.info(`Created briefing in ${Date.now() - t0}ms`);
		return briefing;
	}
}

export { BattleDataReader, ErrorHandlingAgendaStore, BriefingMaker }