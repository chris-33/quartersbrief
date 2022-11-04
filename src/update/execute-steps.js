/**
 * Returns a function that calls the passed `step` function on each member of an array, or each property of an object, instead of 
 * on the array/object as a whole. The returned function returns the array of step results when called on an array, and an object
 * with the `step` function applied to all properties when called on an object.
 * @param  {Function} step The function to apply.
 * @return {Function}      A function that applies `step` on each member of its argument when called with an array, and each property
 * of its argument when called with an object.
 */
export function each(step) {
	return async function(arg) {
		if (Array.isArray(arg)) 
			return arg.map(async member => await step(member));
		else if (typeof arg === 'object') { 
			let result = {};
			for (let key in arg)
				result[key] = await step(arg[key]);
			return result;
		}
	}
}

/**
 * Executes a series of functions, calling each with the result of its predecessor. Returns the last result.
 * @param  {Function[]} steps The functions to execute.
 * @return {*}       The result of the last function.
 */
export default async function executeSteps(steps) {
	let result;
	for (let step of steps) {
		result = await step(result);
	}
	return result;
}