import Topic from '../../topic.js';
import { ShipBuilder } from '../../../util/shipbuilder.js';
import { BW_TO_METERS } from '../../../util/conversions.js';
import { SKILLS } from '../../../model/captain.js';

const CONCEALMENT_BUILD = {
	// modernizations: [ 'PCM027_ConcealmentMeasures_Mod_I' ],
	// skills: [ SKILLS.CONCEALMENT_EXPERT ]
}
const RADAR_BUILD = {
	// modernizations: [ 'PCM042_RLSSearch_Mod_I', 'PCM072_AbilityWorktimeBoost_Mod_I' ],
	skills: [ SKILLS.CONSUMABLES_ENHANCEMENTS ],
}

export default class RadarTopic extends Topic {
	async getPugData(battle, options) {
		let shipBuilder = new ShipBuilder(this.gameObjectProvider);
		const locals = await super.getPugData(battle, options);

		locals.ships = locals.ships.filter(ship => 'rls' in ship.consumables)

		let radars = {};
		await Promise.all(locals.ships.map(async ship => {
			let range = 10 * Math.round(BW_TO_METERS * ship.consumables.rls.distShip / 10);
			radars[range] ??= {};
			radars[range][ship.consumables.rls.workTime] ??= [];
			radars[range][ship.consumables.rls.workTime].push({
				ship,
				baseTime: ship.consumables.rls.workTime,
				maxTime: (await shipBuilder.build(ship, RADAR_BUILD)).consumables.rls.workTime
			});
		}));
		locals.ships = await Promise.all(locals.ships.map(ship => shipBuilder.build(ship, CONCEALMENT_BUILD)));

		locals.radars = radars;
		return locals;
	}
}