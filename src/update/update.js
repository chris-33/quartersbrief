export function each(step) {
	return async function(result) {
		return result.map(async r => await step(r));
	}
}

export async function executeSteps(steps) {
	let result;
	for (let step of steps) {
		result = await step(result);
	}
	return result;
}