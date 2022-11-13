import Topic from '../../topic.js';

export default class OvermatchMeTopic extends Topic {
	caption = 'Overmatch Threat';

	async getPugData(battle, options) {
		const locals = await super.getPugData(battle, options);
		locals.ownPlating = locals.ships
			.find(ship => ship.getID() === locals.teams.player)
			.get('hull.armor.65584');

		return locals;
	}
}