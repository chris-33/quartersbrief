/**
 * The exception that will be thrown if an invariant assertion fails.
 * It includes a description of the invariant that failed and a 
 * counterexample: the data set that caused the assertion to fail.
 * This will make finding the cause of the error a lot easier, since the
 * game's data has grown to be pretty massive.
 */
export default class InvariantError extends Error {
	constructor(invariant, counterexample) {		
		super(`Checking invariant '${invariant}' failed for ${counterexample.name}`);
	}
}