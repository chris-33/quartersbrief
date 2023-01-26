import * as clauses from './clauses.js';

/**
 * An agenda describes how to construct a briefing. It consists of two main constituents: a list of _matchers_ and a hash of _topics_.
 *
 * The matchers determines what ships this agenda pertains to. Each matcher consists of a list of conditions (called clauses) that a ship must fulfill
 * in order to be considered a match for that clause. A ship is considered to match a matcher if it matches all clauses of that matcher. A ship is
 * considered to match an agenda if it matches at least one matcher of the agenda, or if the agenda does not have any matchers.
 * 
 * The topics are the briefing's content.
 */
export default class Agenda {
	matchers;
	topics;

	/**
	 * Constructs a new agenda from the given matchers and topics.
	 * If there is only one matcher in `matchers`, it can be passed directly, i.e. the following two are equivalent:
	 * ```
	 * new Agenda([matcher], topics);
	 * new Agenda(matcher, topics);
	 * ```
	 * This is mostly for legacy reasons, however.
	 * 
	 * @param  {Array|Object} matchers The array of matchers for this agenda. If this is an object but no an array, it will be
	 * turned into an array containing only that object.
	 * @param  {Object} topics   The topics for this agenda.
	 */
	constructor(matchers, topics) {		
		if (typeof matchers === 'object' && matchers !== null && !Array.isArray(matchers))
			matchers = [ matchers ];

		this.matchers = matchers;
		this.topics = topics;
	}

	/**
	 * Checks whether the given battle matches the agenda's matchers section.
	 * A battle is considered a match if for at least one matcher in this agenda's list of matchers,
	 * the ship matches all its clauses.
	 * @param  {Ship} ship The ship which to check.
	 * @return {boolean}      An array containing all matchers the ship matched, or `null` if 
	 * it didn't match any. If this agenda does not have any matchers, this method returns an
	 * array containing an empty object (`[{}]`). Note that this means that if this agenda matches
	 * the given ship, the result is truthy, and falsy otherwise.
	 */
	matches(ship) {
		// If this agenda does not have any matchers, return an array of matches consisting only of the empty matcher
		// (which matches everything).
		// This is necessary so scoring/choosing can work (which it wouldn't without extra work
		// if we just returned true)
		if (!this.matchers) 
			return [{}];

		let result = [];
		for (let matcher of this.matchers) {
			const matches = Object.keys(matcher)
				.every(clause => clauses[clause](ship, matcher[clause]));

			if (matches) 
				result.push(matcher);			
		}

		return result.length > 0 ? result : null;
	}

	/**
	 * Returns the names of all topics defined on this agenda. The topic's data
	 * will be available under `agenda.topics[topicname]`
	 * @return {String[]} The names of all the topics on this agenda.
	 */
	getTopicNames() {
		return Object.keys(this.topics);
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
	static extend(extending, extended) {
		const matchers = extending.matchers ?? extended.matchers;
		const topics = [];
		for (const topic of new Set([ ...Object.keys(extending.topics ?? {}), ...Object.keys(extended.topics ?? {}) ]))
			topics[topic] = Object.assign({}, extended.topics[topic], extending.topics[topic]);

		return new Agenda(matchers, topics);
	}

	static from(data) {
		const result = new Agenda(data.matches, data.topics);
		result.name = data.name;
		return result;
	}
}