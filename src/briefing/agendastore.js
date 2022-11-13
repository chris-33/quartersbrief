import { Agenda } from './agenda.js';
import { readdir, readFile } from 'fs/promises';
import TOML from '@iarna/toml';
import path from 'path';

/**
 * The `AgendaStore` holds all known agendas after reading them from disk.
 */
export default class AgendaStore {
	constructor(agendadir) {		
		this.agendadir = agendadir;
	}

	/**
	 * Reads any files from the provided directory and turns them into `Agenda` objects.
	 * @return {Promise<Agenda[]>} The agendas that were read.
	 */
	async getAgendas() {
		let agendas = await readdir(this.agendadir);
		agendas = await Promise.all(agendas.map(agenda => readFile(path.join(this.agendadir, agenda))));
		return agendas.map(agenda => { 
			agenda = TOML.parse(agenda); 
			return new Agenda(agenda.matches, agenda.topics);
		});
	}

}