import GameObjectProvider from '../../src/providers/gameobjectprovider.js';

/**
 * The `SpecificityChooser` selects the agenda that most specifically matches the player's ship in the battle. 
 * Specificity is calculated according to the following rules:
 * - `ships` matched: 100 pts
 * - `classes`, `tiers`, `nations` matched: 10 pts each
 * - `has` matched: 10 pts for each constitutent part of the clause.
 *
 * This is somewhat inspired by the way CSS selectors work.
 */
export default class SpecificityChooser {	
	static POINTS = {
		ships: 100,
		classes: 10,
		tiers: 10,
		nations: 10,
		has: 10
	}
	static PENALTY = -10000;

	constructor(gameObjectProvider) {
		if (!gameObjectProvider || !(gameObjectProvider instanceof GameObjectProvider))
			throw new TypeError(`Need a GameObjectProvider to create a ${this.constructor.name} but got ${gameObjectProvider}`);

		this.gameObjectProvider = gameObjectProvider;
	}

	/**
	 * Calculates the specificity score of the given `match`, awarding points for each clause as per {@link SpecificityStrategy#POINTS}.
	 * 
	 * @return {number} The specificity score of the match.
	 */
	scoreOf(match) {
		let score = 0;
		for (let prop in match)
			switch (prop) {
				case 'has': score += (Array.isArray(match[prop]) ? match[prop].length : 1) * SpecificityChooser.POINTS.has; break;
				default: score += SpecificityChooser.POINTS[prop];
			}			

		return score;
	}

	/**
	 * Chooses the highest-scoring agenda that matches the ship. If no agendas match the ship,
	 * `chooseAgendas` returns `null`.
	 * @param  {Ship} ship    The ship for which to match.
	 * @param {Agenda[]} agendas The agendas from which to choose.
	 * @return {Agenda}        Returns the agenda with the highest specificity score that matched
	 * the ship, or `null` if no agendas matched.
	 */
	async choose(battle, agendas) {
		const ownship = await this.gameObjectProvider.createGameObject(battle.player.shipId);

		return agendas
			// Map each agenda to an object containing the agenda and all its matchers that matched this battle, if any
			.map(agenda => ({ agenda, matches: agenda.matches(ownship) }))
			// Filter out agendas that didn't match at all
			.filter(entry => entry.matches)
			// For each agenda, find its highest scoring matcher and remember that score
			.map(entry => ({ 
				agenda: entry.agenda, 
				score: Math.max(...entry.matches.map(matcher => this.scoreOf(matcher))) 
			}))
			// Find the highest scoring one, or default to null if no agendas matched
			.reduce((prev, curr) => curr.score > prev.score ? curr : prev, { agenda: null, score: -Infinity})
			// Return the agenda of the highest scorer
			.agenda;
	}
}