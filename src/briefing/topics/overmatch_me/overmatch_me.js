import Topic from '../../topic.js';
import ShipBuilder from '../../../util/shipbuilder.js';
import clone from 'lodash/cloneDeep.js';

const TOP_BUILD = {
	modules: 'top'
}

export default class OvermatchMeTopic extends Topic {
	caption = 'Overmatch Threat';

	async getPugData(battle, options) {
		options = clone(options) ?? {};
		options.filter = options.filter ?? {};
		options.filter.teams = [ 'enemies' ];

		const shipBuilder = new ShipBuilder(this.gameObjectProvider);
		const locals = await super.getPugData(battle, options);
		locals.ships = await Promise.all(locals.ships
			.filter(ship => 'artillery' in ship)
			.map(ship => shipBuilder.build(ship, TOP_BUILD)));
		
		locals.ships.sort((ship1, ship2) => ship2.artillery.caliber - ship1.artillery.caliber);

		locals.ownship = await shipBuilder.build(locals.teams.player, { modules: 'top' });
		locals.armor = {
			side: await this.armorProvider.getArmorView(locals.ownship, 'side'),
		};

		return locals;
	}
}