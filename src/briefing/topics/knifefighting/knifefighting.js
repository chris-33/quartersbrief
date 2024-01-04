import Topic from '../../topic.js';
import { ShipBuilder } from '../../../util/shipbuilder.js';
import { SKILLS } from '../../../model/captain.js';

const HEALTH_BUILD = {
	modules: 'top',
	skills: [ SKILLS.SURVIVABILITY_EXPERT ]
}
const DPM_BUILD = {
	modernizations: [ 'PCM013_MainGun_Mod_III' ]
}

const knifefighting = configuration => configuration.health * configuration.dpm.pertinent;

export default class KnifefightingTopic extends Topic {
	caption = 'Knife Fighting Value';

	async getPugData(battle, options) {
		let shipBuilder = new ShipBuilder(this.gameObjectProvider);

		const locals = await super.getPugData(battle, options);
		locals.ships = locals.ships.filter(ship => 'artillery' in ship);

		const entries = await Promise.all(locals.ships.map(async ship => {
			const entry = { ship, base: {}, max: {} };			

			entry.base.health = ship.hull.health;
			entry.base.reload = ship.get('artillery.mounts.*.reload', { collate: true });

			entry.base.dpm = ship.get('artillery.dpm');
			entry.base.dpm.pertinent = Math.max(entry.base.dpm.cs ?? 0, entry.base.dpm.he ?? 0) || entry.base.dpm.ap;
			entry.base.knifefighting = knifefighting(entry.base);

			await shipBuilder.build(ship, HEALTH_BUILD);
			entry.max.health = ship.hull.health;

			await shipBuilder.build(ship, DPM_BUILD);
			entry.max.reload = ship.get('artillery.mounts.*.reload', { collate: true });
			entry.max.dpm = ship.get('artillery.dpm');
			entry.max.dpm.pertinent = Math.max(entry.max.dpm.cs ?? 0, entry.max.dpm.he ?? 0) || entry.max.dpm.ap;
			entry.max.knifefighting = knifefighting(entry.max);

			return entry;
		}));

		entries.sort((e1, e2) => e1.max.knifefighting - e2.max.knifefighting);
		locals.entries = entries;

		return locals;
	}
}