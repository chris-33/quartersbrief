import Topic from '../../topic.js';
import ShipBuilder from '../../../util/shipbuilder.js';
import { SKILLS } from '../../../model/captain.js';

const ARTILLERY_BUILD = {
	modules: 'top',
	modernizations: [ 
		'PCM008_FireControl_Mod_I', /* appears to have been deactivated */ 
		'PCM015_FireControl_Mod_II', 
		'PCM028_FireControl_Mod_I_US', 'PCM029_FireControl_Mod_II_US', 
		'PCM033_Guidance_Mod_I', 
		'PCM034_Guidance_Mod_0', /* only available for three rather obscure ships (Iwaki Alpha, Yubari, Katori) */ 
		// 'PCM046_Special_Mod_I_Yamato', 'PCM080_Special_Mod_I_ARP_Yamato', 
		'PCM048_Special_Mod_I_Zao',// 'PCM055_Special_Mod_I_Khabarovsk',
		// 'PCM050_Special_Mod_I_Henri_IV', 'PCM096_Special_Mod_I_Petropavlovsk',
		// 'PCM054_Special_Mod_I_Moskva'
	],
	skills: [
		SKILLS.MAIN_BATTERY_AND_AA_EXPERT
	]
}

export default class ArtilleryTopic extends Topic {
	caption = 'Main Artillery';

	async getPugData(battle, options) {
		function* ranges(max) {
			let curr;
			for (curr = 0; curr < max + STEP_SIZE - 1; curr += STEP_SIZE)
				yield Math.min(curr, max);
		}
		const STEP_SIZE = 1000;

		let shipBuilder = new ShipBuilder(this.gameObjectProvider);
		
		const locals = await super.getPugData(battle, options);		
		locals.ships = await Promise.all(locals.ships
			.filter(ship => ship.artillery)
			.map(ship => shipBuilder.build(ship, ARTILLERY_BUILD)));

		locals.ownrange = (await shipBuilder.build(locals.teams.player, ARTILLERY_BUILD))?.artillery.maxRange;

		locals.artilleries = {};
		locals.ships.forEach(ship => {			
			const plot = {};
			for (let r of ranges(ship.artillery.maxRange)) {
				const shot = ship.artillery.mounts[0].shoot(r);
				plot[r] = Math.sqrt(shot.expectedMissDistance[0] ** 2 + shot.expectedMissDistance[1] ** 2)
			}
			locals.artilleries[ship.name] = { 
				plot 
			};
		})
		return locals;
	}
}