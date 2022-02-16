import pug from 'pug';

class BriefingBuilder {
	battle;
	layout;

	constructor(battle, agendaFactory) {
		if (!battle) throw new TypeError('Cannot create a BriefingBuilder without a battle');		
		this.battle = battle;
		this.agendaFactory = agendaFactory;
	}

	getTopicBuilder(topic) {
		return import(`./topics/${topic}/${topic}.js`);
	}

	buildErrorTopic(err) {
		return `There was an error while making the topic: ${err}`;
	}

	async build() {
		let agenda = await this.agendaFactory.chooseAgenda(this.battle.getPlayer().ship);
		if (!agenda || !agenda.topics) return {};
		let briefing = { topics: new Array(agenda.topics.length) };

		// For each briefing content part, get the dedicated builder for that part and build it
		// Assign it to the layout pane dedicated to it
		await Promise.all(agenda.topics.map((topic, index) => {
			this.getTopicBuilder(topic)
				.then(module => {
					briefing.topics[index] = module.buildTopic(this.battle);
				}).catch(err => briefing[`topic${index}`] = this.buildErrorTopic(err));

		}));
		return pug.renderFile('src/briefing/briefing.pug', briefing)
	}
}

export { BriefingBuilder }