import { ShipBuilder } from '../../../util/shipbuilder.js';
import { conversions } from '../../../util/conversions.js';
import pug from 'pug';
import sass from 'sass';
import { filters, teams } from '../common.js';

const BASE_BUILD = {
	modules: 'top'	
}
const CONCEALMENT_BUILD = {
	modernizations: [ 'PCM027_ConcealmentMeasures_Mod_I' ],
	skills: [ 12 ],
	camouflage: 'PCEC001'
}
const RADAR_BUILD = {
	modernizations: [ 'PCM042_RLSSearch_Mod_I' ],
	skills: [ 6 ],
}
async function buildHtml(battle, gameObjectFactory, options) {
	let shipBuilder = new ShipBuilder(gameObjectFactory);
	let ships = battle.getVehicles()
		.map(vehicle => vehicle.shipId)
		.filter(filters.duplicates)
		.map(shipId => gameObjectFactory.createGameObject(shipId))
		.filter(ship => 'rls' in ship.consumables)

	let radars = {};
	ships.forEach(ship => {
		ship = shipBuilder.build(ship, BASE_BUILD);
		let range = 10 * Math.round(conversions.BWToMeters(ship.consumables.rls.distShip) / 10);
		radars[range] ??= {};
		radars[range][ship.consumables.rls.workTime] ??= [];
		radars[range][ship.consumables.rls.workTime].push({
			ship,
			baseTime: ship.consumables.rls.workTime,
			maxTime: shipBuilder.build(ship, RADAR_BUILD).consumables.rls.workTime
		});
	});
	ships.forEach(ship => shipBuilder.build(ship, CONCEALMENT_BUILD));

	const locals = { 
		ships, 
		radars,
		teams: teams(battle),
		options: {
			almostThreshold: options.almostThreshold
		}
	};
	return pug.renderFile('src/briefing/topics/radar/radar.pug', locals);
}

async function buildScss() {
	return sass.compile('src/briefing/topics/radar/radar.scss').css;
}

export default async function buildTopic(battle, gameObjectFactory, options) {
	return {
		html: await buildHtml(battle, gameObjectFactory, options),
		scss: await buildScss(battle, gameObjectFactory, options)
	}
}