import Topic from '../../topic.js';
import ShipBuilder from '../../../util/shipbuilder.js';
import { SKILLS } from '../../../model/captain.js';

const CONCEALMENT_BUILD = {
	modules: 'top',
	modernizations: [ 'PCM027_ConcealmentMeasures_Mod_I' ],
	skills: [ SKILLS.CONCEALMENT_EXPERT ]
}

export default class ConcealmentTopic extends Topic {
	async getPugData(battle, options) {
		let shipBuilder = new ShipBuilder(this.gameObjectProvider);
		
		const locals = await super.getPugData(battle, options);
		// Initialize with base build
		let entries = locals.ships.map(ship => ({
			ship,
			baseConcealment: ship.hull.concealment.sea
		}));
		// Apply concealment build
		locals.ships = await Promise.all(locals.ships.map(ship => shipBuilder.build(ship, CONCEALMENT_BUILD)));
		locals.ships.forEach((ship, index) => entries[index].concealment = ship.hull.concealment.sea);

		if (options?.filter?.limit) {
			entries = entries.filter(entry => entry.concealment <= options.filter.limit);
		}
		entries = entries.sort((entry1, entry2) => entry1.concealment - entry2.concealment);
		locals.entries = entries;

		return locals;
	}
}