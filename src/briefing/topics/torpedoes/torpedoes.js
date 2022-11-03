import pug from 'pug';
import sass from 'sass';
import { ShipBuilder } from '../../../util/shipbuilder.js';
import { SKILLS } from '../../../model/captain.js';
import { filters, teams, sortLikeLoadScreen } from '../common.js';
import { sassFunctions } from '../common.js';


const BASE_BUILD = { modules: 'stock' }
const STEALTH_BUILD = {
	skills: [ SKILLS.CONCEALMENT_EXPERT ]
}
const TORPEDO_BUILD = {
	modernizations: [ 'PCM014_Torpedo_Mod_III', 'PCM070_Torpedo_Mod_IV', 'PCM057_Special_Mod_I_Shimakaze', 'PCM075_Special_Mod_I_Daring' ],
	skills: [ SKILLS.SWIFT_FISH, SKILLS.FILL_THE_TUBES, SKILLS.ENHANCED_TORPEDO_EXPLOSIVE_CHARGE, SKILLS.LIQUIDATOR ],
	signals: [ 'PCEF017_VL_SignalFlag', 'PCEF019_JW1_SignalFlag' ]
}


function buildHtml(battle, gameObjectFactory, options) {
	let shipBuilder = new ShipBuilder(gameObjectFactory);
	let ships = battle.getVehicles()
		.map(vehicle => vehicle.shipId)
		// Filter to those teams set in options.teams, default to everyone
		.filter(filters.teams(teams(battle), options?.filter?.teams ?? []))
		// Filter out duplicates
		.filter(filters.duplicates)
		.map(shipId => shipBuilder.build(shipId, BASE_BUILD))
		// If options.filter.classes is set, filter the ships list accordingly
		.filter(ship => options?.filter?.classes?.includes(ship.getClass()) ?? true)
		.filter(ship => ship.torpedoes)
		.sort(sortLikeLoadScreen);

	const entries = ships.map(ship => {
		const entry = { 
			ship,
			builds: ship.discoverModules('torpedoes').map((module, index) => {
				shipBuilder.build(ship, { 
					modules: `torpedoes: ${index}, others: top`,
					...TORPEDO_BUILD
				});	
				let torpedoes = ship.torpedoes.get('mounts.*.ammoList', { collate: true });
			
				const build = {
					tubes: { port: [], center: [], starboard: [] },
					reload: ship.torpedoes.get('mounts.*.shotDelay', { collate: true }),
					torpedoes: torpedoes.map(torpedo => ({
						torpedo: torpedo,
						range: Math.round(torpedo.getRange() / 10) * 10, // Round to 10m precision
						damage: torpedo.getDamage(),
						speed: torpedo.getSpeed(),
						visibility: torpedo.getVisibility(),
						reaction: torpedo.getVisibility() / torpedo.getSpeed(),
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
		[ 'rection', 'visibility' ].forEach(property => entry[property] = Math.min(...entry.builds.flatMap(build => build.torpedoes).map(torpedo => torpedo[property])));

		entry.reload = Math.min(...entry.builds.map(build => build.reload));
		// Find the build with largest total number of tubes
		const sum = (arr) => arr.reduce((prev,curr) => prev + curr, 0);
		entry.tubes = entry.builds.map(build => Object.values(build.tubes).flat()).reduce((prev, curr) => sum(curr) > sum(prev) ? curr : prev);
		return entry;
	});

	let locals = {
		teams: teams(battle),
		entries,
		options
	}
	return pug.renderFile('src/briefing/topics/torpedoes/torpedoes.pug', locals);
}

async function buildScss(battle, gameObjectFactory, options) {
	return sass.compile('src/briefing/topics/torpedoes/torpedoes.scss', {
		loadPaths: ['node_modules'],
		functions: {
			...sassFunctions.options(options)
		}
	}).css;
}

export default async function buildTopic(battle, gameObjectFactory, options) {
	return {
		html: buildHtml(battle, gameObjectFactory, options),
		scss: await buildScss(battle, gameObjectFactory, options),
	}
}