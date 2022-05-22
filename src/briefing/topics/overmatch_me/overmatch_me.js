import { ShipBuilder } from '../../../util/shipbuilder.js';
import pug from 'pug';
import sass from 'sass';
import { filters, teams } from '../common.js';

const BASE_BUILD = {
	modules: 'top'	
}

function median(arr) {
	arr.sort((a1, a2) => a1-a2);
	let half = Math.floor(arr.length / 2);
	if (arr.length % 2)
		return arr[half];
	else
		return (arr[half - 1] + arr[half]) / 2;
}

async function buildHtml(battle, gameObjectFactory, options) {

	let shipBuilder = new ShipBuilder(gameObjectFactory);
	const locals = {
		teams: teams(battle),
		ships: battle.getEnemies()
			.map(vehicle => vehicle.shipId)
			.filter(filters.duplicates)
			.map(shipId => gameObjectFactory.createGameObject(shipId))
			.filter(filters.classes([ 'Cruiser', 'Battleship' ])),
		ownPlating: median(
			Object.values(gameObjectFactory.createGameObject(battle.getPlayer().shipId).get('hull.armor'))
				.filter(thickness => 19 < thickness <= 50)) // Expect plating to be in this range. This will fail for extremely poorly armored ships as well as exceptionally well-armored, obviously.
	}



	return pug.renderFile('src/briefing/topics/overmatch_me/overmatch_me.pug', locals);
}

async function buildScss() {
	return sass.compile('src/briefing/topics/overmatch_me/overmatch_me.scss').css;
}

export default async function buildTopic(battle, gameObjectFactory, options) {
	return {
		html: await buildHtml(battle, gameObjectFactory, options),
		scss: await buildScss(battle, gameObjectFactory, options)
	}
}