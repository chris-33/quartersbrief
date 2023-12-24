import Topic from '../../topic.js';
import { ShipBuilder } from '../../../util/shipbuilder.js';
import { SKILLS } from '../../../model/captain.js';
import clone from 'lodash/cloneDeep.js';

export default class PenYouTopic extends Topic {
	caption = 'HE & SAP Penetration';

	async getPugData(battle, options) {
		options = clone(options) ?? {};
		options.filter = options.filter ?? {};
		options.filter.teams = [ 'enemies' ];

		const locals = await super.getPugData(battle, options);

		const shipBuilder = new ShipBuilder(this.gameObjectProvider);
		let ownship = await shipBuilder.build(locals.teams.player, { modules: 'top' });
		
		locals.ownship = {
			he: ownship.get('artillery.mounts.*.ammoList', { collate: true }).find(ammo => ammo.get('ammoType') === 'HE')?.get('alphaPiercingHE'),
			sap: ownship.get('artillery.mounts.*.ammoList', { collate: true }).find(ammo => ammo.get('ammoType') === 'CS')?.get('alphaPiercingCS')
		}
		ownship = await shipBuilder.build(ownship, { skills: [ SKILLS.INERTIA_FUSE_FOR_HE_SHELLS ] });
		locals.ownship.ifhe = ownship.get('artillery.mounts.*.ammoList', { collate: true }).find(ammo => ammo.get('ammoType') === 'HE')?.get('alphaPiercingHE');
		
		locals.armors = {};
		for (let ship of locals.ships)
			locals.armors[ship.getName()] = {};

		for (let view of [ 'side', 'top' ])
			await Promise.all(locals.ships.map(ship => this.armorProvider
				.getArmorView(ship, view)
				.catch(err => err) 
				.then(armor => locals.armors[ship.getName()][view] = armor)));

		return locals;
	}
}