/**
 * An agenda describes how to construct a briefing. It consists of two main constituents: a _matcher_ and _topics_.
 * The matcher determines what ships this agenda pertains to. The topics are the briefing's content.
 */
class Agenda {
	/**
	 * ships 100pts
	 * classes 10pts
	 * tiers 10pts
	 * nations 10pts
	 *  
	 * @type Object
	 */
	matcher;
	topics;

	constructor(matcher, topics) {
		this.matcher = matcher;
		this.topics = topics;
	}

	/**
	 * Calculates the specificity score of the matcher.
	 * Matchers get 100 points for matching ships directly,
	 * and 10 points each for matching class, tier and nation.
	 *
	 * This is somewhat inspired by CSS selectors.
	 * @return {number} The specificity score of the agenda's matcher.
	 */
	get score() {
		if (!this.matcher) return undefined;
		// Helper function that returns 1 if the matcher has the property and 0 if it doesn't
		const isset = (prop) => prop in this.matcher ? 1 : 0;
		return isset('ships') * 100
				+ isset('classes') * 10 
				+ isset('tiers') * 10
				+ isset('nations') * 10		
	}	

	/**
	 * Checks whether the given ship matches the agenda's matcher section.
	 * A ship is considered a match if the following conditions are met:
	 * - If the matcher has a ship list, the ship must be in it.
	 * - If the matcher has a class list, the ship's class must be in it.
	 * - If the matcher has a tier list, the ship's tier must be in it.
	 * - If the matcher has a nation list, the ship's nation must be in it.
	 * Any matcher lists that are missing are considered to match everything.
	 * @param  {Ship} ship The ship which to check.
	 * @return {boolean}      `True` if the ship matches, `false` otherwise.
	 */
	matches(ship) {
		if (!this.matcher) return undefined;

		return (this.matcher.ships?.includes(ship.getName()) ?? true)
			&& (this.matcher.classes?.includes(ship.getSpecies()) ?? true)
			&& (this.matcher.tiers?.includes(ship.getTier()) ?? true)
			&& (this.matcher.nations?.includes(ship.getNation()) ?? true);
	}
}

export { Agenda }