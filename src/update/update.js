export async function executeSteps(steps) {
	let result;
	for (let step of steps) {
		result = await step(result);
	}
	return result;
}