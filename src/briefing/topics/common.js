const filters = {
	// Filters out duplicate ids from ids.
	// Useful for use with ship ids
	duplicates: (id, index, ids) => ids.findIndex((other, currIndex) => id === other && currIndex > index) === -1,
	/**
	 * Returns a filter function that includes only ids that are listed in one of the teams in `teams`.
	 * @param  {Object} teams The teams against which to match. Should be an object with keys `allies`, `enemies` and `player`
	 * which are arrays containing ids.
	 * @param {String[] = []} An array of the teams the filter should let pass. Can include `allies`, `enemies`, and `player`. 
	 * If empty, 
	 * @return {Function}       A filter function that returns `true` if a ship is in one of the specified teams.
	 */
	teams: function(teams, show) {
		show ??= [];
		return id => {
			return show.length === 0 ||
				show
					.flatMap(team => Array.isArray(teams[team]) ? 
						teams[team] : // If current team is an array, use it
						[teams[team]]) // If current team is a scalar, turn it into an array. (This happens with teams.player)
					.includes(id);
		}
	},
	classes: function(classes) {
		return ship => classes.includes(ship.getClass());
	}
}

function sortLikeLoadScreen(ship1, ship2) {
	const classValue = {
		'AirCarrier': 500,
		'Battleship': 400,
		'Cruiser': 300,
		'Destroyer': 200,
		'Submarine': 100
	}
	let v1 = classValue[ship1.getClass()] + ship1.getTier();
	let v2 = classValue[ship2.getClass()] + ship2.getTier();
	return v2 - v1; // Reverse sort order
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

export { filters, sortLikeLoadScreen, teams }