/**
 * Filters out duplicate ids from `ids`.
 */
export function duplicates(id, index, ids) {
	return ids.findIndex((other, currIndex) => id === other && currIndex > index) === -1
}

/**
 * Returns a filter function that includes only ids that are listed in one of the teams in `show`.
 * @param  {Object} teams The teams against which to match. Should be an object with keys `allies`, `enemies` and `player`
 * which are arrays containing ids.
 * @param {String[] = []} An array of the teams the filter should let pass. Can include `allies`, `enemies`, and `player`. 
 * If empty, all teams pass the filter.
 * @return {Function}       A filter function that returns `true` if a ship id is in one of the specified teams to show.
 */
export function teams(teams, show) {
	show ??= [];
	return id => {
		return show.length === 0 ||
			show
				.flatMap(team => Array.isArray(teams[team]) ? 
					teams[team] : // If current team is an array, use it
					[teams[team]]) // If current team is a scalar, turn it into an array. (This happens with teams.player)
				.includes(id);
	}
}
/**
 * Returns a filter function that only includes a ship if it is of one of the classes specified in `classes`.
 *
 * If classes is empty, all classes are considered a match.
 * @param  {String[]} classes The classes to let pass
 * @return {Function}         A function that compares a ship's class to the specified classes, and returns true
 * if it is included in them.
 */
export function classes(classes) {
	classes ??= [];
	return ship => classes.length === 0 || classes.includes(ship.class);
}

/**
 * Sorts ships like they appear on the load screen
 * - aircraft carriers followed by battleships followed by cruisers followed by destroyers followed by submarines,
 * - within a class, higher tiers come before lower tiers,
 * - within a class and tier, ships are sorted by nations according to the second letter of their `index` property
 *
 * This function is intended be passed to `Array.prototype.sort`.
 */
export function loadScreenSort(ship1, ship2) {
	const classValue = {
		'AirCarrier': 500,
		'Battleship': 400,
		'Cruiser': 300,
		'Destroyer': 200,
		'Submarine': 100
	}
	let v1 = classValue[ship1.class] + ship1.tier;
	let v2 = classValue[ship2.class] + ship2.tier;
	// Reverse sort order (higher class and tier first)
	v1 *= -1;
	v2 *= -1;

	// If classes and tiers are equal, the game seems to sort them by nation,
	// according to the second letter of the reference code
	if (v1 === v2) {
		v1 = ship1.refcode.charCodeAt(1);
		v2 = ship2.refcode.charCodeAt(1);
	}

	return v1 - v2;
}