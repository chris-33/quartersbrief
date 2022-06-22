import pug from 'pug';
import sass from 'sass';
import { filters, teams } from '../common.js';

async function buildHtml(battle, gameObjectFactory, options) {
	const locals = {
		teams: teams(battle),
		ships: battle.getEnemies()
			.map(vehicle => vehicle.shipId)
			.filter(filters.duplicates)
			.map(shipId => gameObjectFactory.createGameObject(shipId))
			.filter(filters.classes([ 'Cruiser', 'Battleship' ])),
		ownPlating: gameObjectFactory.createGameObject(battle.getPlayer().shipId).get('hull.armor.65584')
	}

	return pug.renderFile('src/briefing/topics/overmatch_me/overmatch_me.pug', locals);
}

async function buildScss() {
	return sass.compile('src/briefing/topics/overmatch_me/overmatch_me.scss').css;
}

export default async function buildTopic(battle, gameObjectFactory, options) {
	return {
		html: await buildHtml(battle, gameObjectFactory, options),
		scss: await buildScss(battle, gameObjectFactory, options),
		caption: 'Overmatch Threat'
	}
}