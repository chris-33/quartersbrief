import pug from 'pug';
import sass from 'sass';
import { ShipBuilder } from '../../../util/shipbuilder.js';
import { filters, teams } from '../common.js';

const BASE_BUILD = {
	modules: 'stock'
}
const CONCEALMENT_BUILD = {
	modules: 'top',
	modernizations: [ 'PCM027_ConcealmentMeasures_Mod_I' ],
	skills: [ 12 ]
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
	
	let entries = ships.map(ship => ({
		ship,
		baseConcealment: ship.getConcealment()
	}));
	ships = ships.map(ship => shipBuilder.build(ship, CONCEALMENT_BUILD));
	ships.forEach((ship, index) => entries[index].concealment = ship.getConcealment())	;

	if (options?.filter?.limit) {
		entries = entries.filter(entry => entry.concealment <= options.filter.limit);
	}
	entries = entries.sort((entry1, entry2) => entry1.concealment - entry2.concealment);

	let locals = {
		teams: teams(battle),
		entries
	}
	return pug.renderFile('src/briefing/topics/concealment/concealment.pug', locals);
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