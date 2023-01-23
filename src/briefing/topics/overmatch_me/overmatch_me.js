import Topic from '../../topic.js';
import { ShipBuilder } from '../../../util/shipbuilder.js';
import clone from 'clone';

export default class OvermatchMeTopic extends Topic {
	caption = 'Overmatch Threat';

	async getPugData(battle, options) {
		options = clone(options) ?? {};
		options.filter = options.filter ?? {};
		options.filter.teams = [ 'enemies' ];

		const locals = await super.getPugData(battle, options);
		locals.ships = locals.ships.filter(ship => 'artillery' in ship);

		locals.ownship = new ShipBuilder(this.gameObjectFactory).build(locals.teams.player, { modules: 'top' });
		locals.armor = {
			side: await this.armorViewer.view(locals.ownship, 'side'),
		};

		return locals;
	}
}