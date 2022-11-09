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

	constructor(sources, chooser) {
		this.sources = sources;
		this.chooser = chooser;
	}

	/**
	 * Let the `this.chooser` select an agenda for the `battle` from all the agendas of all of
	 * this `AgendaController`'s sources.
	 * @param  {Battle} battle The battle to select an `Agenda` for.
	 * @return {Agenda}        The agenda that the chooser selected.
	 */
	async choose(battle) {
		let agendas = await Promise.all(this.sources.map(source => source.getAgendas()));
		agendas = agendas.flat();
		return this.chooser.choose(battle, agendas);
	}
}