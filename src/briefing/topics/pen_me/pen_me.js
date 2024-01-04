import Topic from '../../topic.js';
import { ShipBuilder } from '../../../util/shipbuilder.js';
import { SKILLS } from '../../../model/captain.js';
import clone from 'lodash/cloneDeep.js';

const TOP_BUILD = {
	modules: 'top'
}

export default class HEPenMeTopic extends Topic {
	caption = 'HE & SAP Vulnerability';

	async getPugData(battle, options) {
		options = clone(options) ?? {};
		options.filter = options.filter ?? {};
		options.filter.teams = [ 'enemies' ];

		const shipBuilder = new ShipBuilder(this.gameObjectProvider);
		const locals = await super.getPugData(battle, options);
		locals.ships = await Promise.all(locals.ships
			.filter(ship => 'artillery' in ship)
			.filter(ship => {
				const ammos = ship.get('artillery.mounts.*.ammos.*.ammoType');
				return ammos.includes('he') || ammos.includes('sap');
			})
			.map(ship => shipBuilder.build(ship, TOP_BUILD)));

		locals.ownship = await shipBuilder.build(locals.teams.player, TOP_BUILD);
		locals.armor = {
			side: await this.armorProvider.getArmorView(locals.ownship, 'side'),
			top: await this.armorProvider.getArmorView(locals.ownship, 'top'),
		};
		
		locals.pens = Object.fromEntries(await Promise.all(locals.ships.map(async ship => {
			const pen = { ship, caliber: ship.artillery.caliber, ammos: {} };
			const ammos = Object.values(ship.get('artillery.mounts.*.ammos', { collate: true })).filter(ammo => ammo.ammoType !== 'ap');
			ammos.forEach(ammo => {
				const piercing = ammo.pen;
				let ammoType = ammo.ammoType;
				pen.ammos[ammoType] = piercing;
			});
			// Get pen with IFHE:
			ship = await shipBuilder.build(ship, { skills: [ SKILLS.INERTIA_FUSE_FOR_HE_SHELLS ]});
			pen.ammos.ifhe = ship.get('artillery.mounts.*[ammos.he].ammos.he.pen', { collate: true });

			return [ ship.name, pen ];
		})));

		return locals;
	}
}