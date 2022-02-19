/**
 * The `SpecificityStrategy` chooses the agenda that most specifically matches the ship. Specificity is calculated according to
 * the following rules:
 * - `ships` defined: 100 pts
 * - `classes`, `tiers`, `nations` defined: 10 pts each.
 * @see {Agenda#score}
 */
class SpecificityStrategy {
	/**
	 * Chooses the highest-scoring agenda that matches the ship. If no agendas match the ship,
	 * `chooseAgendas` returns `null`.
	 * @param  {Ship} ship    The ship for which to match.
	 * @param {Agenda[]} agendas The agendas from which to choose.
	 * @return {Agenda}        Returns the agenda with the highest specificity score that matched
	 * the ship, or `null` if no agendas matched.
	 */
	chooseAgenda(battle, agendas) {
		agendas = agendas.filter(agenda => agenda.matches(battle));
		if (agendas.length === 0) return null;
		return agendas.reduce((a1,a2) => a1.score > a2.score ? a1 : a2);
	}
}

export { SpecificityStrategy };