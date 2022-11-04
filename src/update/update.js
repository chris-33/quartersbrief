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

export async function executeSteps(steps) {
	let result;
	for (let step of steps) {
		result = await step(result);
	}
	return result;
}