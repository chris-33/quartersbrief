import pug from 'pug';
import sass from 'sass';
import { ShipBuilder } from '../../../util/shipbuilder.js';
import { SKILLS } from '../../../model/captain.js';
import { filters, teams } from '../common.js';
import { sassFunctions } from '../common.js';

const BASE_BUILD = {
	modules: 'stock'
}
const TOP_BUILD = {
	modules: 'top'
}
const STEALTH_BUILD = {
	skills: [ SKILLS.CONCEALMENT_EXPERT ]
}
const TORPEDO_BUILD = {
}


function buildHtml(battle, gameObjectFactory, options) {
	let shipBuilder = new ShipBuilder(gameObjectFactory);
	let ships = battle.getVehicles()
		.map(vehicle => vehicle.shipId)
		// Filter out duplicates
		.filter(filters.duplicates)
		.map(shipId => shipBuilder.build(shipId, BASE_BUILD))
		// If options.filter.classes is set, filter the ships list accordingly
		.filter(ship => options?.filter?.classes?.includes(ship.getClass()) ?? true)
		.filter(ship => ship.torpedoes);

	const entries = ships.map(ship => {
		const entry = { ship, base: {}, max: {} };
		
		shipBuilder.build(ship, TOP_BUILD);
		let torpedoes = ship.torpedoes.get('mounts.*.ammoList', { collate: true });
		entry.range = Math.max(...torpedoes.map(torpedo => torpedo.getRange()));
		entry.damage = Math.max(...torpedoes.map(torpedo => torpedo.getDamage()));
		entry.speed = Math.max(...torpedoes.map(torpedo => torpedo.getSpeed()));
		entry.tubes = ship.torpedoes.get('mounts.*.numBarrels');
		
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