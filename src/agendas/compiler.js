import Agenda from './agenda.js';
import { readdir, readFile } from 'fs/promises';
import TOML from '@iarna/toml';
import YAML from 'yaml';
import path from 'path';
import circular from 'is-circular';
import clone from 'clone';

const parsers = {
	'.yml': YAML,
	'.yaml': YAML,
	'.toml': TOML,
	'.json': JSON
};

export default {

}
export async function load(agendadir) {
	// Read all files in this AgendaStore's agenda dir:
	let agendas = await readdir(agendadir);
	// Ignore files that we don't have a parser for:
	agendas = agendas.filter(filename => path.extname(filename).toLowerCase() in parsers);

	agendas = await Promise.all(agendas.map(async filename => {
		let agenda = await readFile(path.join(agendadir, filename), 'utf-8');
	
		const parser = parsers[path.extname(filename).toLowerCase()];			
		agenda = parser.parse(agenda);
		return agenda;
	}));
	return agendas;
}

export function link(agenda, agendas) {
	if (agenda.extends) {
		const extended = agendas?.find(other => other.name === agenda.extends);
		if (!extended)
			throw new Error(`Agenda ${agenda.name} extends ${agenda.extends} which could not be found`);

		agenda.extends = extended;
	}
	return agenda;
}

	/**
	 * Create a new `Agenda` by extending `extending` with `extended`, as per the following rules:
	 * - If `extending` defines matchers, use them
	 * - If `extending` does not define matchers, use `extended`'s matchers
	 * - The new agenda has all topics from `extending` and from `extended`
	 * - If a topic is defined in both, keep all its properties as in `extending`, adding those from `extended` that
	 * are not present in `extending`
	 * 
	 * @param  {Agenda} extending The agenda to extend
	 * @param  {Agenda} extended  The agenda to extend from
	 * @return {Agenda}           The agenda resulting from the extension.
	 */

export function extend(extending, extended) {
	if (!extending.matchers && extended.matchers)
		extending.matchers = extended.matchers;

	const topics = clone(extended.topics) ?? {};

	for (let topicName in extending.topics) {
		topics[topicName] = Object.assign(topics[topicName] ?? {}, extending.topics[topicName])
	}
	extending.topics = topics;
	return extending;
}

export function compile(agenda) {
	if (!agenda.extends) 
		return Agenda.from(agenda);
	
	// Check that the chain of agenda extends properties has no cycle, 
	// because that would give us an infinite recursion
	if (circular(agenda))
		throw new TypeError(`Agenda ${agenda.name} has a circular extension chain`);

	agenda = extend(agenda, compile(agenda.extends));
	delete agenda.extends;
	
	return Agenda.from(agenda);
}