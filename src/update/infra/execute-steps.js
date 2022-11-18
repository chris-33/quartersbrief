/**
 * Returns a function that calls the passed `step` function on each member of an array, or each property of an object, instead of 
 * on the array/object as a whole. The returned function returns the array of step results when called on an array, and an object
 * with the `step` function applied to all properties when called on an object.
 *
 * `step` is executed sequentially on each member/property: It is guaranteed that when `step` is run with the second member of the 
 * array, it has completed (not just started) for the first. (Analagously for objects.)
 * @param  {Function} step The function to apply.
 * @return {Function}      A function that applies `step` on each member of its argument when called with an array, and each property
 * of its argument when called with an object.
 */
export function each(step) {
	return async function(arg) {
		if (Array.isArray(arg)) {
			let result = [];
			for (let member of arg)
				// Not using Promise.all with arg.map() here because we want the steps to be executed sequentially
				result.push(await step(member));
			return result;
		}
		else if (typeof arg === 'object') { 
			let result = {};
			for (let key in arg)
				result[key] = await step(arg[key]);
			return result;
		}
	}
}

/**
 * Returns a function that calls the passed `step` function and ignores its result, returning the argument that was provided
 * to `step` instead.
 *
 * This allows inserting steps where the result is not important, and continue processing as if that function was not there.
 * @param  {Function} step The function to call
 * @return {*}      The argument that was supplied to `step`. 
 */
export function passthrough(step) {
	return async function(arg) {
		await step(arg);
		return arg;
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