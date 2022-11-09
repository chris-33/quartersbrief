import Topic from '../../topic.js';
import { loadScreenSort } from '../../topic-filters.js';

export default class WinrateTopic extends Topic {
	async getPugData(battle, options) {
		function enrich(participant) {
			participant.player = players[participant.name];
			participant.ship = ships.find(ship => ship.getID() === participant.shipId);
		}

		const players = await this.playerFactory.getPlayers(battle.getVehicles().map(vehicle => vehicle.name));

		const ships = battle.getVehicles().map(vehicle => this.gameObjectFactory.createGameObject(vehicle.shipId));
		const allies = battle.getAllies();
		allies.push(battle.getPlayer());
		const enemies = battle.getEnemies();

		allies.forEach(enrich);
		enemies.forEach(enrich);

		allies.sort((p1, p2) => loadScreenSort(p1.ship, p2.ship));
		enemies.sort((p1, p2) => loadScreenSort(p1.ship, p2.ship));

		return {
			allies,
			enemies,
			player: battle.getPlayer(),
			options
		}
	}
}