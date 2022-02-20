import { BriefingBuilder } from '../briefing/briefingbuilder.js';
import { SpecificityStrategy } from '../briefing/specificitystrategy.js';
import { Battle } from '../model/battle.js';
import { readFile } from 'fs/promises';
import log from 'loglevel';
import path from 'path';

// How to make a briefing:
// 1. Read the battle parameters from tempArenaInfo.json
// 	error handling: ENOENT -> no battle currently
// @todo Make a template to render if no battle
// 2. Enrich it with the participating ships (and in the future, players)
//  error handling: if a ship can't be found, display an error in the briefing to that effect
// 3. Get all agendas
//  error handling: what if no agendas are defined
// 4. Choose the one that best fits the battle
//  error handling: what if no agenda fits
// 5. Build the briefing as per the chosen agenda

class BattleDataReader {
	constructor(replaydir) {
		this.replaydir = replaydir;
	}

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

class ErrorHandlingAgendaStore {
	constructor(agendaStore) {
		this.agendaStore = agendaStore;
	}

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

class BriefingMaker {
	constructor(replaydir, gameObjectFactory, agendaStore) {
		this.battleDataReader = new BattleDataReader(replaydir);
		this.gameObjectFactory = gameObjectFactory;
		this.errorHandlingAgendaStore = new ErrorHandlingAgendaStore(agendaStore);
	}

	async makeBriefing() {debugger;
		// Helper function to enrich the passed battle with game objects like ships and players
		async function enrichBattle(battle, gameObjectFactory) {
			return await Promise.allSettled(battle.get('vehicles').map(vehicle => vehicle.ship = gameObjectFactory.createGameObject(vehicle.shipId))); // Assignments are expressions in js
			// @todo Enrich with player data - possibly lazily using proxy objects if the WoWS API is call limited
		}

		let battle = await this.battleDataReader.read();
		if (battle === null) {
			// @todo Render special template for "no battle"
			return
		}
		battle = new Battle(battle);
		await enrichBattle(battle, this.gameObjectFactory);
		let agendas = await this.errorHandlingAgendaStore.getAgendas();
		let agenda = new SpecificityStrategy().chooseAgenda(battle, agendas);
		if (agenda === null) {
			// @todo Render special template for "no agenda fit the battle"
			return
		}
		return await new BriefingBuilder(battle, agenda, this.gameObjectFactory).build();
	}
}

export { BriefingMaker, BattleDataReader, ErrorHandlingAgendaStore }