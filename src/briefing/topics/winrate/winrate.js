import { PlayerFactory } from '../../../model/playerfactory.js';
import config from '../../../../src/init/config.js';
import pug from 'pug';
import sass from 'sass';
import { sortLikeLoadScreen, sassFunctions } from '../common.js';

async function buildHtml(battle, gameObjectFactory, options) {
	function enrich(participant) {
		participant.player = players[participant.name];
		participant.ship = ships.find(ship => ship.getID() === participant.shipId);

		// Pass getClass and getTier through to ship to allow sorting:
		participant.getClass = participant.ship.getClass.bind(participant.ship);
		participant.getTier = participant.ship.getTier.bind(participant.ship);
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

	const allies = battle.getAllies();
	allies.push(battle.getPlayer());
	const enemies = battle.getEnemies();
	
	allies.forEach(enrich);
	enemies.forEach(enrich);

	allies.sort(sortLikeLoadScreen);
	enemies.sort(sortLikeLoadScreen);

	const locals = { allies, enemies, player: battle.getPlayer(), options };
	return pug.renderFile('src/briefing/topics/winrate/winrate.pug', locals);
}

async function buildScss(battle, gameObjectFactory, options) {
	return sass.compile('src/briefing/topics/winrate/winrate.scss', {
		functions: {
			...sassFunctions.options(options)
		}
	}).css;
}

export default async function buildTopic(battle, gameObjectFactory, options) {
	return {
		html: await buildHtml(battle, gameObjectFactory, options),
		scss: await buildScss(battle, gameObjectFactory, options)
	}
}