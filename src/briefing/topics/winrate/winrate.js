import { readFile } from 'fs/promises';
import { PlayerFactory } from '../../../model/playerfactory.js';
import config from '../../../../src/init/config.js';
import pug from 'pug';
import clone from 'clone';

const render = pug.compileFile('src/briefing/topics/winrate/winrate.pug');

async function buildHtml(battle, gameObjectFactory, options) {
	function enrich(partipant) {
		partipant.player = players[partipant.name];
		partipant.ship = ships.find(ship => ship.getID() === partipant.shipId);
	}

	function sortLikeLoadScreen(p1, p2) {
		const classValue = {
			'AirCarrier': 500,
			'Battleship': 400,
			'Cruiser': 300,
			'Destroyer': 200,
			'Submarine': 100
		}
		let v1 = classValue[p1.ship.getClass()] + p1.ship.getTier();
		let v2 = classValue[p2.ship.getClass()] + p2.ship.getTier();
		return v2 - v1; // Reverse sort order
	}

	// Check that required options api-key and realm are set, and create a more readable error message if they are not.
	// Otherwise, we will get something cryptic from the PlayerFactory.
	if (!config.apiKey || !config.realm) {
		let msg = '';
		let missingBoth = !config.apiKey && !config.realm;
		if (!config.apiKey) msg += 'Wargaming API key ';
		if (!config.apiKey && !config.realm) msg += 'and ';
		if (!config.realm) msg += 'realm ';
		msg += `not set. You can set ${missingBoth ? 'them' : 'it'} in your quartersbrief config file or pass ${missingBoth ? 'them' : 'it'} on the command line.`;
		throw new Error(msg);
	}
	let players = await new PlayerFactory(config.apiKey, config.realm).getPlayers(battle.getVehicles().map(vehicle => vehicle.name));
	let ships = battle.getVehicles()
		.map(vehicle => gameObjectFactory.createGameObject(vehicle.shipId));

	const allies = clone(battle.getAllies());
	allies.push(clone(battle.getPlayer()));
	const enemies = clone(battle.getEnemies());
	
	allies.forEach(enrich);
	enemies.forEach(enrich);

	allies.sort(sortLikeLoadScreen);
	enemies.sort(sortLikeLoadScreen);

	const locals = { allies, enemies, player: battle.getPlayer() };
	return render(locals);
}

async function buildScss() {
	return readFile('src/briefing/topics/winrate/winrate.scss');
}

export default async function buildTopic(battle, gameObjectFactory, options) {
	return {
		html: await buildHtml(battle, gameObjectFactory, options),
		scss: await buildScss(battle, gameObjectFactory, options)
	}
}