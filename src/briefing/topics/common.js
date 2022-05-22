const filters = {
	duplicates: (ship, index, ships) => ships.findIndex((otherShip, currIndex) => ship === otherShip && currIndex > index) === -1
}

function teams(battle) {
	const result = {
			allies: battle.getAllies().map(vehicle => vehicle.shipId),
			enemies: battle.getEnemies().map(vehicle => vehicle.shipId),
			player: battle.getPlayer().shipId		
	}
	result.allies.push(result.player);
	return result;
}

export { filters, teams }