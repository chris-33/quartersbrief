import * as compiler from '../agendas/compiler.js';
import rootlog from 'loglevel';

/**
 * The `AgendaController` is in charge of managing a list of agenda sources (`AgendaStore`s), and
 * choosing one of them for a given `Battle` using a `chooser`.
 */
export default class AgendaController {
	constructor() {
		throw new TypeError(`AgendaController cannot be instantiated with new. Use the static create method instead.`);
	}

	/**
	 * Let the `this.chooser` select an agenda for the `battle` from all the agendas of all of
	 * this `AgendaController`'s sources.
	 * @param  {Battle} battle The battle to select an `Agenda` for.
	 * @return {Agenda}        The agenda that the chooser selected.
	 */
	async choose(battle) {
		for (let source of this.sources) {
			const choice = await this.chooser.choose(battle, source);
			if (choice)
				return choice;
		}
	}

	static async create(sources, chooser) {
		sources ??= [];
		sources = await Promise.all(sources.map(async source => {
			try {
				return await compiler.load(source);
			} catch(err) {
				if (err.code === 'ENOENT') 
					rootlog.debug(`Agenda source directory at ${source} does not exist`);
				else if (err.code === 'EACCES')
					rootlog.debug(`Agenda source directory at ${source} could not be accessed`);
				else throw err;
				return [];
			}
		}));
		
		const agendas = sources.flat();
		agendas.forEach(agenda => compiler.link(agenda, agendas));
		sources = sources.map(source => source.map(compiler.compile));
		// sources = sources.map(source => source
		// 	.map(agenda => compiler.link(agenda, agendas))
		// 	.map(compiler.compile));

		const controller = Object.create(AgendaController.prototype);
		controller.sources = sources;
		controller.chooser = chooser;
		return controller;
	}
}