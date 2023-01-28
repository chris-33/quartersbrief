import * as compiler from '../agendas/compiler.js';

/**
 * The `AgendaController` is in charge of managing a list of agenda sources (`AgendaStore`s), and
 * choosing one of them for a given `Battle` using a `chooser`.
 */
export default class AgendaController {
	// @todo Feature: Agendas can extend each other.
	// This would require the AgendaController to perform crude linking and compiling tasks:
	// - LINK the extend source given in the agenda to the matching agenda object from one of the sources
	// - COMPILE the agenda contents based on the extended agenda and the extending agenda
	// This has to be done in the AgendaController (as opposed to the AgendaStore), because 
	// the AgendaController is the only place that has access to all sources. 
	// If we did it in the AgendaStore, agendas could only extend from others in the same location. 
	// But we want to have a default set of agendas that can then be altered by the user.

	constructor() {
		throw new TypeError(`AgendaController cannot be instantiated with new. Use the static create method instead.`);
	}

	/**
	 * Let the `this.chooser` select an agenda for the `battle` from all the agendas of all of
	 * this `AgendaController`'s sources.
	 * @param  {Battle} battle The battle to select an `Agenda` for.
	 * @return {Agenda}        The agenda that the chooser selected.
	 */
	choose(battle) {
		for (let source of this.sources) {
			const choice = this.chooser.choose(battle, source);
			if (choice)
				return choice;
		}
	}

	static async create(sources, chooser) {
		sources ??= [];
		sources = await Promise.all(sources.map(source => compiler.load(source)));
		
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