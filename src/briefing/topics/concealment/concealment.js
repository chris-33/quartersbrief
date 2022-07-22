import pug from 'pug';
import sass from 'sass';
import { ShipBuilder } from '../../../util/shipbuilder.js';
import { arrayIntersect } from '../../../util/util.js';
import { filters, teams } from '../common.js';

const render = pug.compileFile('src/briefing/topics/concealment/concealment.pug');

const CONCEALMENT_BUILD = {
	modules: 'top',
	modernizations: [ 'PCM027_ConcealmentMeasures_Mod_I' ],
	skills: [ 12 ]
}

function buildHtml(battle, gameObjectFactory, options) {
	let shipBuilder = new ShipBuilder(gameObjectFactory);
	let ships = battle.getVehicles()
		.map(vehicle => vehicle.shipId)
		.filter(filters.duplicates)
		.map(ship => shipBuilder.build(ship, CONCEALMENT_BUILD))
		// Sort by concealment
		.sort((ship1, ship2) => ship1.getConcealment() - ship2.getConcealment());	

	if (options?.filter?.classes)
		ships = ships.filter(ship => options.filter.classes.includes(ship.getClass()));
	if (options?.filter?.limit)
		ships = ships.filter(ship => ship.getConcealment() <= options.filter.limit);

	let locals = {
		ships: ships,
		...teams(battle),
	}
	locals.allies.push(locals.player); // The player is an ally
	locals.both = arrayIntersect(locals.allies, locals.enemies);
	return render(locals);
}

async function buildScss() {
	return sass.compile('src/briefing/topics/concealment/concealment.scss').css;
}

export default async function buildTopic(battle, gameObjectFactory, options) {
	return {
		html: buildHtml(battle, gameObjectFactory, options),
		scss: await buildScss(battle, gameObjectFactory, options)
	}
}