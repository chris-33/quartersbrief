import { Agenda } from './agenda.js';
import { readdir, readFile } from 'fs/promises';
import TOML from '@iarna/toml';

/**
 * The `AgendaFactory` can read agenda definitions from disk and choose the highest-scoring agenda matching
 * a given `Ship`.
 */
class AgendaFactory {
	constructor(agendadir) {		
		this.agendadir = agendadir;
	}

	/**
	 * Reads any files from the provided directory and turns them into `Agenda` objects.
	 * @return {Promise<Agenda[]>} The agendas that were read.
	 */
	async getAgendas() {
		let agendas = await readdir(this.agendadir);
		agendas = await Promise.all(agendas.map(agenda => readFile(this.agendadir + '/' + agenda)));
		return agendas.map(agenda => { agenda = TOML.parse(agenda); return new Agenda(agenda.matches, agenda.topics) });		
	}

	/**
	 * Chooses the highest-scoring agenda that matches the ship. If no agendas match the ship,
	 * `chooseAgendas` will return `null`.
	 * @param  {Ship} ship    The ship for which to match.
	 * @return {Agenda}        Returns the agenda with the highest specificity score that matched
	 * the ship, or `null` if no agendas matched.
	 */
	async chooseAgenda(ship) {
		let agendas = await this.getAgendas();
		agendas = agendas.filter(agenda => agenda.matches(ship));
		if (agendas.length === 0) return null;
		return agendas.reduce((a1,a2) => a1.score > a2.score ? a1 : a2);
	}

	getTopicBuilder(topic) {
		return import(`./topics/${topic}/${topic}.js`);		
	}
}

export { AgendaFactory }