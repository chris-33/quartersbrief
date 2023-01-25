// Helper function that creates a simple lookup clause so we don't have to write them all by hand
// It constructs a getter name by taking the property, capitalizing the first letter and prefixing it with 'get'.
// It then returns a clause function that checks that the "required" parameter includes the result of invoking that getter on the ship.
function createClause(property) {
	let getter = `get${property[0].toUpperCase() + property.slice(1)}`;
	return function(ship, required) {
		return required.includes(ship[getter]());
	}
}

export const classes = createClause('class');
export const nations = createClause('nation');
export const tiers = createClause('tier');
export const ships = createClause('name');
