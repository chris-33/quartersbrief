import pug from 'pug';

/**
 * The `BriefingBuilder` constructs a briefing for a given battle and agenda. It dynamically imports the 
 * topic builder for each topic of the agenda, then calls this with the battle and a `GameObjectFactory`.
 * If no topic builder could be found, it constructs a special `error topic` for that topic, but finishes
 * the briefing otherwise.
 */
class BriefingBuilder {
	/**
	 * Creates a new `BriefingBuilder`.
	 * @param  {Battle} battle            The battle for which the briefing will be.
	 * @param  {GameObjectFactory} gameObjectFactory A game object factory that will be passed to each
	 * topic builder.
	 * @throws Throws an error if either the `battle` or the `agenda` are missing. It is possible to create
	 * a briefing builder without a game object factory, but note that topic builders will then also not
	 * have one available.
	 */
	constructor(battle, agenda, gameObjectFactory) {
		if (!battle) throw new Error('Cannot create a BriefingBuilder without a battle');		
		this.battle = battle;
		if (!agenda) throw new Error('Cannot create a BriefingBuilder without an agenda');		
		this.agenda = agenda;
		this.gameObjectFactory = gameObjectFactory;
	}

	/**
	 * Dynamically imports the topic builder for the given `topic`. Topic builders will be expected
	 * to be a file with the topic's name and extension '.js' in a subdirectory of the topic's name,
	 * exporting a single function of length 2 as default.
	 * @param  {String} topic The topic for which to get a topic builder.
	 * @return {Promise}       A promise that resolves to the topic builder, or rejects if none could be found.
	 */
	getTopicBuilder(topic) {
		return import(`./topics/${topic}/${topic}.js`);
	}

	/**
	 * Constructs an error topic for missing topic builders.
	 * @param  {Error} err The error that prevented a topic builder from being available.
	 * @return {String}     A string containing the HTML for the error topic.
	 */
	buildErrorTopic(err) {
		return `There was an error while making the topic: ${err}`;
	}

	/**
	 * Builds a briefing using the battle and the agenda.
	 * @return {string} A string containing the HTML for the briefing.
	 */
	async build() {
		const self = this;
		if (!self.agenda || !self.agenda.topics) return {};
		let briefing = { topics: new Array(self.agenda.topics.length) };

		// For each briefing content part, get the dedicated builder for that part and build it
		// Assign it to the layout pane dedicated to it
		await Promise.allSettled(self.agenda.topics.map((topic, index) => {
			this.getTopicBuilder(topic)
				.then(module => {
					briefing.topics[index] = module.buildTopic(self.battle, self.gameObjectFactory);
				}).catch(err => briefing[`topic${index}`] = self.buildErrorTopic(err));

		}));
		return pug.renderFile('src/briefing/briefing.pug', briefing)
	}
}

export { BriefingBuilder }