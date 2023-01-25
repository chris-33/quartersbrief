// Helper function that creates a simple lookup clause so we don't have to write them all by hand
// It constructs a getter name by taking the property, capitalizing the first letter and prefixing it with 'get'.
// It then returns a clause function that checks that the "required" parameter includes the result of invoking that getter on the DataObject.
function createClause(property) {
	let getter = `get${property[0].toUpperCase() + property.slice(1)}`;
	return function(data, required) {
		return required.includes(data[getter]());
	}
}

export const classes = createClause('class');
export const nations = createClause('nation');
export const tiers = createClause('tier');
export const ships = createClause('name');

export function has(data, required) {
	// The regular expression for a single has-clause expresion:
	// - An expression is a sequence of the form <prop><op><val>. <op> and <val> are optional, but must either both be present or both be absent
	// - <prop>, <op> and <val> may be separated by arbitrary sequences of whitespace, including no whitespace
	// - <prop> is a string of characters. It may include dots, but not as the first or last character
	// - <op> is one of <, <=, ==, =>, or >
	// - <val> is a sequence of at least one character, digit or whitespace
	const EXPR_REGEX = /^(?<prop>(?!\.)[\w.]+(?<!\.))(?:\s*(?<op><|<=|==|>=|>)\s*(?<val>[\w\s]+))?$/;
	const COMPARATORS = {
		'<': (a,b) => a < b,
		'<=': (a,b) => a <= b,
		'==': (a,b) => a == b,
		'>=': (a,b) => a >= b,
		'>': (a,b) => a > b,
		'><': a => Boolean(a) // "virtual" operator that we will use to cast to a boolean. This is what will be used when the expression contained no operator and value
	};

	if (!Array.isArray(required))
		required = [ required ];
	
	return required
		// Translate expressions from strings to objects { prop, op, val }
		.map(expr => {
			let result = EXPR_REGEX.exec(expr);
			if (!result) throw new TypeError(`${expr} is not a valid has-clause`)
			else return result.groups
		})
		// Map each expresion object to the result of its evaluation
		.map(({ prop, op, val }) => COMPARATORS[op ?? '><'](data.get(prop), val))
		// Will be true iff all entries of the array are truthy
		.every(Boolean);
}
