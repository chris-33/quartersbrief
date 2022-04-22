/**
 * The `SpecificityStrategy` chooses the agenda that most specifically matches the player's ship in the battle. 
 * Specificity is calculated according to the following rules:
 * - `ships` matched: 100 pts
 * - `classes`, `tiers`, `nations` matched: 10 pts each.
 *
 * This is somewhat inspired by CSS selectors.
 */
class SpecificityStrategy {	
	static POINTS = {
				ships: 100,
				classes: 10,
				tiers: 10,
				nations: 10		
	}
	static PENALTY = -10000;

	constructor(gameObjectFactory) {
		this.gameObjectFactory = gameObjectFactory;
	}

	/**
	 * Calculates the specificity score of the `agenda`'s `matches` section, taking into account the
	 * entries for `ships`, `classes`, `tiers` and `nations` by the following rules:
	 * - if the entry is not present, the agenda gets awarded 0 points for it,
	 * - if it is present and matches `ownship`, the agenda gets awarded points as per {@link SpecificityStrategy#POINTS},
	 * - if it is present ant does not match `ownship`, the agenda gets penalized by the value of {@link SpecificityStrategy#PENALTY}. 
	 * The value of the penalty is large enough to ensure a non-match will always result in a negative return value.
	 * 
	 * @return {number} The specificity score of the agenda's matcher.
	 */
	_getScore(ownship, agenda) {
		function score(prop) {
			const targets = {
				ships: 'getName',
				classes: 'getClass',
				tiers: 'getTier',
				nations: 'getNation'
			}
			if (agenda.matcher?.[prop]) 
				return agenda.matcher[prop].includes(ownship[targets[prop]].call(ownship)) ? 
					SpecificityStrategy.POINTS[prop] : 
					SpecificityStrategy.PENALTY;
			else 
				return 0;
		}
		return [ 'ships', 'classes', 'tiers', 'nations' ]
			.map(score)
			.reduce((prev, curr) => prev + curr, 0);
	}

	/**
	 * Chooses the highest-scoring agenda that matches the ship. If no agendas match the ship,
	 * `chooseAgendas` returns `null`.
	 * @param  {Ship} ship    The ship for which to match.
	 * @param {Agenda[]} agendas The agendas from which to choose.
	 * @return {Agenda}        Returns the agenda with the highest specificity score that matched
	 * the ship, or `null` if no agendas matched.
	 */
	chooseAgenda(battle, agendas) {
		let ownship = this.gameObjectFactory.createGameObject(battle.getPlayer().shipId);

		return agendas
			// Calculate a score for every agenda.
			// agendas now contains objects of the form { agenda, score }
			.map(agenda => ({ agenda, score: this._getScore(ownship, agenda) }))
			// Filter out all agendas that didn't actually match the ownship
			.filter(entry => entry.score >= 0)
			// Find the highest scoring one, or default to null if no agendas matched
			.reduce((prev, curr) => curr.score > prev.score ? curr : prev, { agenda: null, score: -Infinity})
			// Return the agenda of the highest scorer
			.agenda;
	}
}

export { SpecificityStrategy };