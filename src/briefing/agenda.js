/**
 * An agenda describes how to construct a briefing. It consists of two main constituents: a _matcher_ and _topics_.
 * The matcher determines what ships this agenda pertains to. The topics are the briefing's content.
 */
class Agenda {
	matcher;
	topics;

	constructor(matcher, topics) {
		this.matcher = matcher;
		this.topics = topics;
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

export { Agenda }