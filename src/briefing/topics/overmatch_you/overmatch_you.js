import Topic from '../../topic.js';

export default class OvermatchYouTopic extends Topic {
	caption = 'Overmatch Capability';

	async getPugData(battle, options) {
		const locals = await super.getPugData(battle, options);

		locals.ownship = locals.ships.find(ship => ship.getID() === locals.teams.player);
		locals.ships = locals.ships
			.filter(ship => locals.teams.enemies.includes(ship.getID()))

		locals.armors = {};
		await Promise.all(locals.ships.map(ship => this.armorViewer
			.view(ship, 'side')
			.catch(err => err) 
			.then(armor => locals.armors[ship.getName()] = armor)));

		return locals;
	}
}