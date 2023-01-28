import Topic from '../../topic.js';
import { ShipBuilder } from '../../../util/shipbuilder.js';
import { SKILLS } from '../../../model/captain.js';


const CONCEALMENT_BUILD = {
	modernizations: [ 'PCM027_ConcealmentMeasures_Mod_I' ],
	skills: [ SKILLS.CONCEALMENT_EXPERT ]
}
const TORPEDO_BUILD = {
	modernizations: [ 'PCM014_Torpedo_Mod_III', 'PCM070_Torpedo_Mod_IV', 'PCM057_Special_Mod_I_Shimakaze', 'PCM075_Special_Mod_I_Daring' ],
	skills: [ SKILLS.SWIFT_FISH, SKILLS.FILL_THE_TUBES, SKILLS.ENHANCED_TORPEDO_EXPLOSIVE_CHARGE, SKILLS.LIQUIDATOR ],
	signals: [ 'PCEF017_VL_SignalFlag', 'PCEF019_JW1_SignalFlag' ]
}

export default class TorpedoesTopic extends Topic {
	async getPugData(battle, options) {
		let shipBuilder = new ShipBuilder(this.gameObjectFactory);
		const locals = await super.getPugData(battle, options);
		locals.ships = locals.ships.filter(ship => ship.torpedoes)

		const entries = locals.ships.map(ship => {
			const entry = { 
				ship,
				builds: ship.discoverModules('torpedoes').map((module, index) => {
					shipBuilder.build(ship, { 
						modules: `torpedoes: ${index}, others: top`,
						...TORPEDO_BUILD,
						...CONCEALMENT_BUILD
					});	
					let torpedoes = ship.torpedoes.get('mounts.*.ammoList', { collate: true });
				
					const build = {
						tubes: { port: [], center: [], starboard: [] },
						reload: ship.torpedoes.get('mounts.*.shotDelay', { collate: true }),
						torpedoes: torpedoes.map(torpedo => ({
							torpedo: torpedo,
							range: Math.round(torpedo.getRange() / 50) * 50, // Round to 50m precision
							damage: torpedo.getDamage(),
							speed: torpedo.getSpeed(),
							visibility: torpedo.getVisibility(),
							flooding: torpedo.getFloodChance()
						}))
					}
					ship.torpedoes.get('mounts').forEach(mount => {
						let side = [ 'port', 'center', 'starboard' ][Math.sign(mount.position[1] - 1) + 1]; // Any mount position smaller/larger than 1 results in port/stbd (resp.), position 1 is center
						build.tubes[side].push(mount.numBarrels);
					});

					return build;
				})
			};
			
			[ 'range', 'damage', 'speed', 'flooding' ].forEach(property => entry[property] = Math.max(...entry.builds.flatMap(build => build.torpedoes).map(torpedo => torpedo[property])));
			[ 'visibility' ].forEach(property => entry[property] = Math.min(...entry.builds.flatMap(build => build.torpedoes).map(torpedo => torpedo[property])));

			entry.reload = Math.min(...entry.builds.map(build => build.reload));
			// Find the build with largest total number of tubes
			const sum = (arr) => arr.reduce((prev,curr) => prev + curr, 0);
			entry.tubes = entry.builds.map(build => Object.values(build.tubes).flat()).reduce((prev, curr) => sum(curr) > sum(prev) ? curr : prev);
			return entry;
		});

		locals.entries = entries;
		locals.ownship = this.gameObjectFactory.createGameObject(battle.getPlayer().shipId);
		return locals;
	}
}