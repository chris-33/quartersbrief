import { ShipBuilder } from '../../../util/shipbuilder.js';
import { conversions } from '../../../util/conversions.js';
import pug from 'pug';
import sass from 'sass';
import { filters, teams as _teams } from '../common.js';

const BASE_BUILD = {
	modules: 'top'	
}
const HYDRO_BUILD = {
	modernizations: [ 'PCM041_SonarSearch_Mod_I', 'PCM072_AbilityWorktimeBoost_Mod_I' ],
	signals: [ 'PCEF029_Sonar_AirDef_SignalFlag' ],
	skills: [ 6 ],
}
async function buildHtml(battle, gameObjectFactory, options) {
	let shipBuilder = new ShipBuilder(gameObjectFactory);
	const teams = _teams(battle);
	teams.allies.push(teams.player);
	let ships = battle.getVehicles()		
		.map(vehicle => vehicle.shipId)
		// Filter to those teams set in options.teams, default to everyone
		.filter(filters.teams(teams, options.filter?.teams ?? []))
		.filter(filters.duplicates)
		.map(shipId => gameObjectFactory.createGameObject(shipId))
		.filter(ship => 'sonar' in ship.consumables)

	let hydros = {};
	ships.forEach(ship => {
		ship = shipBuilder.build(ship, BASE_BUILD)
		// Round range to 50m precision, to avoid drawing separate circles for what is effectively the same range
		// if ships' consumables' distShip is slightly different (which will be magnified by the conversion to meters)
		let range = 50 * Math.round(conversions.BWToMeters(ship.consumables.sonar.distShip) / 50);
		const hydro = {
			ship: ship,
			baseTime: ship.consumables.sonar.workTime,
			maxTime: shipBuilder.build(ship, HYDRO_BUILD).consumables.sonar.workTime,
			cooldown: ship.consumables.sonar.reloadTime
		};

		hydros[range] ??= [];
		hydros[range].push(hydro);
	});
	const locals = { 
		ships, 
		hydros,
		teams
	};
	return pug.renderFile('src/briefing/topics/hydro/hydro.pug', locals);
}

async function buildScss() {
	return sass.compile('src/briefing/topics/hydro/hydro.scss').css;
}

export default async function buildTopic(battle, gameObjectFactory, options) {
	return {
		html: await buildHtml(battle, gameObjectFactory, options),
		scss: await buildScss(battle, gameObjectFactory, options)
	}
}