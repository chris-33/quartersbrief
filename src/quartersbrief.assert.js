var GameObject = require('$/src/model/gameobject');
var log = require('loglevel');
var clone = require('just-clone'); // Library to deep-copy objects


/**
 * This modules checks that some invariants that were found through reverse engineering are actually
 * true. The code of this program depends on these, but of course we cannot be entirely sure that
 * we reverse engineered them correctly.
 *
 * This module exports a function that will check all invariants, but individual checks are also
 * exposed as properties of the exported function should the need arise to run or re-run an individual 
 * check.
 * 
 * If one of the assertions fails, an InvariantError will be thrown.
 */

/**
 * Main function. It will call all of its enumerable properties that are functions,
 * passing along its `data` parameter. Any thrown InvariantErrors will be caught,
 * collected, and thrown together in the end as an AggregateError.
 * @param  {Object} data The data object to test.
 * @throws Throws an `AggregateError` containing the `InvariantError`s of any failed
 * invariant assertions.
 */
function assertInvariants(data) {
	let fns = Object.values(assertInvariants)
		.filter(x => x instanceof Function && x !== InvariantError); // Exclude InvariantError, which was also exposed as a property of assertInvariants
	let exceptions = [];

	for (fn of fns) {
		try {
			fn.call(null, data);
		} catch (error) {			
			if (error instanceof InvariantError)
				exceptions.push(error);
			else throw error;
		}
	}

	if (exceptions.length > 0)
		throw new AggregateError(exceptions);
}

/**
 * The exception that will be thrown if an invariant assertion fails.
 * It includes a description of the invariant that failed and a list
 * of counterexamples: the data sets that caused the assertion to fail.
 * This will make finding the cause of the error a lot easier, since the
 * game's data has grown to be pretty massive.
 */
class InvariantError extends Error {
	constructor(invariant, counterexamples) {		
		super(`Checking invariant \'${invariant}\' failed: violated by ${counterexamples}`);
	};
}
assertInvariants.InvariantError = InvariantError;

/**
 * 	Helper function that checks every object in data. 
 * 	Returns an array of key names of all those objects for which the passed
 * 	function was false, null if the function was true for all objects.
 *
 *  This function is not exposed on module.exports.
 */
function violates(data, fn) {	
	var counterexamples = [];
	for (let key in data) {
		if (!fn(data[key])) 
			counterexamples.push(key);
		}
	return counterexamples.length > 0 ? counterexamples : null;
}

/**
 * All game objects must have a numeric ID.
 */
assertInvariants.assertHaveIDs = function(data) {
	let counterexamples = violates(data, obj => obj.hasOwnProperty('id') && typeof obj.id === 'number');
	if (counterexamples) 
		throw new InvariantError('every game object has a numeric property "id"', counterexamples);	
}

/**
 * Every game object has a reference code (Wargaming calls them "index") conforming to the
 * regex GameObject.REFERENCE_CODE_REGEX.
 */
assertInvariants.assertHaveIndices = function(data) {
	let counterexamples = violates(data, obj => obj.hasOwnProperty('index') && typeof obj.index === 'string' && GameObject.REFERENCE_CODE_REGEX.test(obj.index));
	if (counterexamples) 
		throw new InvariantError('every game object has a well-formed property "index"', counterexamples);	
}

/**
 * Every game object has a reference name conforming to the regex {@link GameObject#REFERENCE_NAME_REGEX}.
 */
assertInvariants.assertHaveNames = function(data) {
	let counterexamples = violates(data, obj => obj.hasOwnProperty('name') && typeof obj.name === 'string' && GameObject.REFERENCE_NAME_REGEX.test(obj.name));
	if (counterexamples) 
		throw new InvariantError('every game object has a well-formed property "name"', counterexamples);
}

/**
 * If a ship's upgrade has a component definition that includes more than one possibility for
 * that component, there must be some other upgrades that will specifiy this component exactly.
 */
/*
	This assertion's algorithm works as follows:
	- For every ship, check if the component definitions of all its upgrades have length 1. In
	  that case, there cannot be any ambiguity, and we are done.
	- If this is not the case, there is at least one upgrade with at least one component definition of 
	  length more than 1. This is called a problematic upgrade, that component definition is called
	  a problematic component definition.
	- If this upgrade has several problematic component definitions, split it into several new
	  upgrades that have one problematic component definition each.
	- Find any upgrades for this ship that have a different ucType (that means, can be equipped
	  simultaneously with the problematic upgrade) and include a component definition for the
	  same component (the problematic component). Intersect this component definition with the 
	  problematic component definition from the problematic upgrade. 
	- If the result has length 1, this upgrade resolved the ambiguity. We are done with this 
	  problematic upgrade, repeat with any other problematic upgrades. 
	- If the result does not have length 1, try to find another upgrade that remedies the remaining
	  ambiguity, now excluding both the problematic upgrade's ucType and the ucType of the upgrade
	  that contributed to resolving the ambiguity in the previous step.
 */
assertInvariants.assertUpgradeComponentsResolveUnambiguously = function(data) {
	let counterexamples = [];
	let ships = Object.values(data).filter(obj => obj.typeinfo.type === 'Ship');
	for (ship of ships) {
		// Filter upgrades to objects, because ShipUpgradeInfo contains some
		// other things, too. (Even some primitives)
		let upgrades = Object.values(ship.ShipUpgradeInfo)
			.filter(obj => typeof obj === 'object' && !Array.isArray(obj));
		
		// Do a quick check first: If all arrays are length 1, there can't be any ambiguity
		if (upgrades.every(upgrade => 
						Object.values(upgrade.components).every(component => component.length <= 1))) {
			log.debug(`For ${ship.name} All components were at most length 1, continuing`);
			continue;
		}

		// Not all arrays were length 1, there is some ambiguity here.
		// We will have to construct the full research trees and check all possible
		// configurations for the invariant		
		// 
		// Make a deep copy of the data first it won't matter when we change it	
		upgrades = clone(ship.ShipUpgradeInfo);
		// Augment the values with their key names
		upgrades = Object.entries(upgrades)
			.filter(kv => typeof kv[1] === 'object' && !Array.isArray(kv[1]))
			.map(kv => { kv[1]['quartersbrief_name'] = kv[0]; return kv[1]; });
		
		// Get a list of those upgrades that are problematic in that they have
		// a component definition that has more than one entry
		let problematic = upgrades.filter(upgrade => Object.values(upgrade.components).some(component => component.length > 1));
		log.debug(`Problematic upgrades are ${problematic.map(x => x.quartersbrief_name)}`);
		

		// Split any upgrades with more than one problem into several upgrades with one problem each
		let toDelete = [];
		let toAdd = [];
		for (problem of problematic) {
			// Get the keys of all component that have a length > 1
			let problematicComponentKeys = Object.keys(problem.components).filter(componentKey => problem.components[componentKey].length > 1);
			// If the array of key names is itself longer than 1, this problematic upgrade must be split
			if (problematicComponentKeys.length > 1) {
				log.debug(`Upgrade ${problem.quartersbrief_name} has more than one problem: ${problematicComponentKeys}. Splitting.`);
				// Mark the upgrade for deletion
				toDelete.push(problem);
				// Construct new problems for each problematic component
				for (problematicComponentKey of problematicComponentKeys) {
					// Make a deep copy
					let newProblem = clone(problem);
					// Then delete all problematic components except one
					for (otherKey of problematicComponentKeys.filter(component => component !== problematicComponentKey)) {
						log.debug(`Deleting ${otherKey} which is ${JSON.stringify(newProblem.components[otherKey])}`)
						delete newProblem.components[otherKey];
					}
					// Mark the new problem for addition
					toAdd.push(newProblem);
					log.debug(`Created problem ${problematicComponentKey} for ${newProblem.quartersbrief_name}`);
				}
			}				
		}
		problematic = problematic.filter(problem => !toDelete.includes(problem));
		problematic = problematic.concat(toAdd);

		// Now try to find remedies for the problematic upgrades.
		for (problem of problematic) {
			let problematicComponentKey = Object.keys(problem.components).filter(key => problem.components[key].length > 1);
			let problematicComponent = problem.components[problematicComponentKey];
			log.debug(`For ${problem.quartersbrief_name} problem narrowed down to ${problematicComponentKey} which is ${problematicComponent}`);

			// The ucTypes of all upgrades that have a definition for the problem field.
			// This is so that we don't consider more than one upgrade of a specific
			// ucType
			// Initialize to the problematic upgrade's ucType, obviously we can't equip
			// any more of this type anyway.
			let contributors = [ problem.ucType ];
			// For every upgrade
			for (upgrade of upgrades) {
				// Only look at upgrades that have not contributed yet
				if (contributors.includes(upgrade.ucType)) continue;

				// If this upgrade contains a definition pertaining to the 
				// problematic component
				if (problematicComponentKey in upgrade.components) {
					// Intersect problematicComponent with the entries for the problematic
					// component in that upgrade
					problematicComponent = problematicComponent.filter(x => upgrade.components[problematicComponentKey].includes(x));
					// Add the upgrade's ucType to the list of contributors, because we
					// have "equipped" it now.
					contributors.push(upgrade.ucType);
					log.debug(`Found upgrade ${upgrade.quartersbrief_name} that has a definition for ${problematicComponentKey}. Problematic component is now ${problematicComponent}`);
				}
				// If that narrowed it down to length 1, we're done with this problem
				if (problematicComponent.length === 1) {
					log.debug(`Problem solved for ${problem.quartersbrief_name} ${problematicComponentKey}`)
					break;						
				}
			}
			if (problematicComponent.length > 1) {
				counterexamples.push(`${ship.name}.ShipUpgradeInfo.${upgrade.quartersbrief_name}.${problematicComponentKey}`);
			}
		}
	}
	if (counterexamples.length > 0) 
		throw new InvariantError('all upgrades\' components must be resolvable unambiguously', counterexamples);
}


module.exports = assertInvariants;