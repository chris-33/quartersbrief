import { ShipBuilder } from '../../../util/shipbuilder.js';
import { readFile } from 'fs/promises';
import { conversions } from '../../../util/conversions.js';
import pug from 'pug';

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
		.map(vehicle => vehicle.ship)
		.filter(ship => 'rls' in ship.consumables)

	ships.forEach(ship => shipBuilder.build(ship, BASE_BUILD));
	let radars = {};
	for (let ship of ships)
		radars[ship.getName()] = { 
			distance: conversions.BWToMeters(ship.consumables.rls.get('distShip')),
			base: ship.consumables.rls.get('workTime') 
		}

	ships.forEach(ship => shipBuilder.build(ship, RADAR_BUILD));
	for (let ship of ships)
		radars[ship.getName()].max = ship.consumables.rls.get('workTime');

	ships.forEach(ship => shipBuilder.build(ship, CONCEALMENT_BUILD));

	const locals = { 
		ships, 
		radars,
		teams: {
			allies: battle.getAllies().map(vehicle => vehicle.ship),
			enemies: battle.getEnemies().map(vehicle => vehicle.ship),
			player: battle.getPlayer().ship
		} 
	};
	return pug.renderFile('src/briefing/topics/radar/radar.pug', locals);
}

async function buildScss() {
	return readFile('src/briefing/topics/radar/radar.scss');
}

export default async function buildTopic(battle, gameObjectFactory, options) {
	return {
		html: await buildHtml(battle, gameObjectFactory, options),
		scss: await buildScss(battle, gameObjectFactory, options)
	}
}