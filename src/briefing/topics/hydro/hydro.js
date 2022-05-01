import { ShipBuilder } from '../../../util/shipbuilder.js';
import { readFile } from 'fs/promises';
import { conversions } from '../../../util/conversions.js';
import pug from 'pug';

const BASE_BUILD = {
	modules: 'top'	
}
const HYDRO_BUILD = {
	modernizations: [ 'PCM041_SonarSearch_Mod_I' ],
	skills: [ 6 ],
}
async function buildHtml(battle, gameObjectFactory, options) {
	let shipBuilder = new ShipBuilder(gameObjectFactory);
	const teams = {
			allies: battle.getAllies().map(vehicle => vehicle.shipId),
			enemies: battle.getEnemies().map(vehicle => vehicle.shipId),
			player: battle.getPlayer().shipId
	}
	teams.allies.push(teams.player);
	let ships = battle.getVehicles()		
		.map(vehicle => vehicle.shipId)
		// Filter to those teams set in options.teams
		.filter(shipId => {
			let displayed = options?.filter?.teams?.flatMap(team => teams[team]) ?? [];
			return displayed.length === 0 || displayed.includes(shipId);
		})
		// Filter out duplicates
		.filter((ship, index, ships) => ships.findIndex((otherShip, currIndex) => ship === otherShip && currIndex > index) === -1)
		.map(shipId => gameObjectFactory.createGameObject(shipId))
		.filter(ship => 'sonar' in ship.consumables)

	let hydros = {};	
	ships.forEach(ship => {
		ship = shipBuilder.build(ship, BASE_BUILD)
		// Round range to 10m precision, to avoid drawing separate circles for what is effectively the same range
		// if ships' consumables' distShip is slightly different (which will be magnified by the conversion to meters)
		let range = 10 * Math.round(conversions.BWToMeters(ship.consumables.sonar.distShip) / 10);
		hydros[range] ??= [];
		hydros[range].push({
			ship: ship,
			baseTime: ship.consumables.sonar.workTime,
			maxTime: shipBuilder.build(ship, HYDRO_BUILD).consumables.sonar.workTime
		});
	});
	const locals = { 
		ships, 
		hydros,
		teams
	};
	return pug.renderFile('src/briefing/topics/hydro/hydro.pug', locals);
}

async function buildScss() {
	return readFile('src/briefing/topics/hydro/hydro.scss');
}

export default async function buildTopic(battle, gameObjectFactory, options) {
	return {
		html: await buildHtml(battle, gameObjectFactory, options),
		scss: await buildScss(battle, gameObjectFactory, options)
	}
}