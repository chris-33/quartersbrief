import Topic from '../../topic.js';

export default class OvermatchMeTopic extends Topic {
	caption = 'Overmatch Threat';

	async getPugData(battle, options) {
		const locals = await super.getPugData(battle, options);
		locals.ships = locals.ships.filter(ship => 'artillery' in ship);

		locals.ownship = locals.ships.find(ship => ship.getID() === locals.teams.player);
		locals.armor = {
			side: await this.armorViewer.view(locals.ownship, 'side'),
		};

		return locals;
	}
}