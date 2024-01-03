import Topic from '../../topic.js';
import { ShipBuilder } from '../../../util/shipbuilder.js';
import clone from 'lodash/cloneDeep.js';

export default class OvermatchYouTopic extends Topic {
	caption = 'Overmatch Capability';

	async getPugData(battle, options) {
		options = clone(options) ?? {};
		options.filter = options.filter ?? {};
		options.filter.teams = [ 'enemies' ];

		const locals = await super.getPugData(battle, options);

		locals.ownship = await new ShipBuilder(this.gameObjectProvider).build(locals.teams.player, { modules: 'top' });
		locals.ships = locals.ships
			.filter(ship => locals.teams.enemies.includes(ship.id))

		locals.armors = {};
		await Promise.all(locals.ships.map(ship => this.armorProvider
			.getArmorView(ship, 'side')
			.catch(err => err) 
			.then(armor => locals.armors[ship.name] = armor)));

		return locals;
	}
}