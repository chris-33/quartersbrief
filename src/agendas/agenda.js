/**
 * An agenda describes how to construct a briefing. It consists of two main constituents: a _matcher_ and _topics_.
 * The matcher determines what ships this agenda pertains to. The topics are the briefing's content.
 */
export default class Agenda {
	matcher;
	topics;

	constructor(matcher, topics) {
		this.matcher = matcher;
		this.topics = topics;
	}

	/**
	 * Checks whether the given battle matches the agenda's matcher section.
	 * A battle is considered a match if the following conditions are met for
	 * the player's ship:
	 * - If the matcher has a ship list, the ship must be in it.
	 * - If the matcher has a class list, the ship's class must be in it.
	 * - If the matcher has a tier list, the ship's tier must be in it.
	 * - If the matcher has a nation list, the ship's nation must be in it.
	 * Any matcher lists that are missing are considered to match everything.
	 * @param  {Ship} ship The battle which to check.
	 * @return {boolean}      `True` if the ship matches, `false` otherwise.
	 */
	matches(ship) {
		if (!this.matcher) return true;

		return (this.matcher.ships?.includes(ship.getName()) ?? true)
			&& (this.matcher.classes?.includes(ship.getSpecies()) ?? true)
			&& (this.matcher.tiers?.includes(ship.getTier()) ?? true)
			&& (this.matcher.nations?.includes(ship.getNation()) ?? true);
	}

	/**
	 * Returns the names of all topics defined on this agenda. The topic's data
	 * will be available under `agenda.topics[topicname]`
	 * @return {String[]} The names of all the topics on this agenda.
	 */
	getTopicNames() {
		return Object.keys(this.topics);
	}
}