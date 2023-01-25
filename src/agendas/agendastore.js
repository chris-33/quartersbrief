import Agenda from './agenda.js';
import { readdir, readFile } from 'fs/promises';
import TOML from '@iarna/toml';
import YAML from 'yaml';
import path from 'path';

const parsers = {
	'.yml': YAML,
	'.yaml': YAML,
	'.toml': TOML,
	'.json': JSON
};

/**
 * The `AgendaStore` holds all known agendas after reading them from disk.
 */
export default class AgendaStore {
	constructor(agendadir) {		
		this.agendadir = agendadir;
	}

	/**
	 * Reads any .toml, .json or .yaml/.yml files from the provided directory and turns them into `Agenda` objects.
	 * @return {Promise<Agenda[]>} The agendas that were read.
	 */
	async getAgendas() {
		// Read all files in this AgendaStore's agenda dir:
		let agendas = await readdir(this.agendadir)
		// Ignore files that we don't have a parser for:
		agendas = agendas.filter(filename => path.extname(filename).toLowerCase() in parsers);

		agendas = await Promise.all(agendas.map(async filename => {
			let agenda = await readFile(path.join(this.agendadir, filename), 'utf-8');
			
			const parser = parsers[path.extname(filename).toLowerCase()];			
			agenda = parser.parse(agenda);

			return new Agenda(agenda.matches, agenda.topics);
		}));
		return agendas;
	}

}