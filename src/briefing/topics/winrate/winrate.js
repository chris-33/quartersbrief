import Topic from '../../topic.js';
import { loadScreenSort } from '../../topic-filters.js';

export default class WinrateTopic extends Topic {
	async getPugData(battle, options) {
		function enrich(participant) {
			participant.player = players[participant.name];
			participant.ship = ships.find(ship => ship.id === participant.shipId);
		}

		const players = await this.playerProvider.getPlayers(battle.vehicles.map(vehicle => vehicle.name));

		const ships = await Promise.all(battle.vehicles.map(vehicle => this.gameObjectProvider.createGameObject(vehicle.shipId)));
		const allies = battle.allies;
		allies.push(battle.player);
		const enemies = battle.enemies;

		allies.forEach(enrich);
		enemies.forEach(enrich);

		allies.sort((p1, p2) => loadScreenSort(p1.ship, p2.ship));
		enemies.sort((p1, p2) => loadScreenSort(p1.ship, p2.ship));

		return {
			allies,
			enemies,
			player: battle.player,
			options
		}
	}
}