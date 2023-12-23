import GameObject from '../model/gameobject.js';
import rootlog from 'loglevel';
import clone from 'lodash/cloneDeep.js';
import { arrayIntersect } from '../util/util.js';
import InvariantError from './infra/invarianterror.js';

/**
 * @module quartersbrief.assert.js
 * @description
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
 * All game objects must have a numeric ID.
 */
export function haveID(gameObject) {
	if (!gameObject.hasOwnProperty('id') || typeof gameObject.id !== 'number') 
		throw new InvariantError('every game object has a numeric property "id"', gameObject);	
}

/**
 * Every game object has a reference code (Wargaming calls them "index") conforming to the
 * regex GameObject.REFERENCE_CODE_REGEX.
 */
export function haveIndex(gameObject) {
	if (!gameObject.hasOwnProperty('index') || typeof gameObject.index !== 'string' || !GameObject.REFERENCE_CODE_REGEX.test(gameObject.index)) 
		throw new InvariantError('every game object has a well-formed property "index"', gameObject);	
}

/**
 * Every game object has a reference name conforming to the regex {@link GameObject#REFERENCE_NAME_REGEX}.
 */
export function haveName(gameObject) {
	if (!gameObject.hasOwnProperty('name') || typeof gameObject.name !== 'string' || !GameObject.REFERENCE_NAME_REGEX.test(gameObject.name)) 
		throw new InvariantError('every game object has a well-formed property "name"', gameObject);
}

/**
 * No game object has a property called "label", because we are using that name to attach human-readable names to game objects.
 */
export function haveNoLabel(gameObject) {
	if (gameObject.hasOwnProperty('label'))
		throw new InvariantError('no game object has a property "label"', gameObject);
}

/**
 * If a ship's module has a component definition that includes more than one possibility for
 * that component, there must be some other modules that will specifiy this component exactly.
 */
export function moduleComponentsResolveUnambiguously(ship) {
	if (ship.typeinfo?.type !== 'Ship') return;

	/*
		This assertion's algorithm works as follows:
		- Check if the component definitions of all its modules have length 1. In
		  that case, there cannot be any ambiguity, and we are done.
		- If this is not the case, there is at least one module with at least one component definition of 
		  length more than 1. This is called a problematic module, that component definition is called
		  a problematic component definition.
		- If this module has several problematic component definitions, split it into several new
		  modules that have one problematic component definition each.
		- Find any modules for this ship that have a different ucType (that means, can be equipped
		  simultaneously with the problematic module) and include a component definition for the
		  same component (the problematic component). Intersect this component definition with the 
		  problematic component definition from the problematic module. 
		- If the result has length 1, this module resolved the ambiguity. We are done with this 
		  problematic module, repeat with any other problematic modules. 
		- If the result does not have length 1, try to find another module that remedies the remaining
		  ambiguity, now excluding both the problematic module's ucType and the ucType of the module
		  that contributed to resolving the ambiguity in the previous step.
	 */
	let dedicatedlog = rootlog.getLogger('assertInvariants');
	let counterexamples = [];
	// An array of ship IDs that the "ignored known violator" warning was already given for. Otherwise we get a bunch of duplicate warnings -
	// one for every component involved in the violation.
	let ignoredWarnings = [];
	

	dedicatedlog.debug(`Checking invariant assertModuleComponentsResolveUnambiguously for ${ship.name}`);
	
	// Do a quick check first: If all arrays are length 1, there can't be any ambiguity
	if (Object.values(ship.ShipUpgradeInfo)
		// Filter to objects, because ShipUpgradeInfo contains some
		// other things, too. (Even some primitives)
		.filter(obj => typeof obj === 'object' && !Array.isArray(obj))
		.every(module => Object.values(module.components).every(component => component.length <= 1))) {
		
		dedicatedlog.debug(`For ${ship.name} All components were at most length 1, continuing`);
		return;
	}

	// Not all arrays were length 1, there is some ambiguity here.
	// We will have to check if it gets resolved by the other modules.
	// 
	// Make a WeakMap to store object keys, so we can reference them in log output
	let moduleNames = new WeakMap();	
	// Store key names
	let modules = Object.entries(ship.ShipUpgradeInfo)
		.filter(kv => typeof kv[1] === 'object' && !Array.isArray(kv[1]))
		.map(([ name, mod ]) => { moduleNames.set(mod, name); return mod; });
	
	// Get a list of those modules that are problematic in that they have
	// a component definition that has more than one entry
	let problematic = modules.filter(module => Object.values(module.components).some(component => component.length > 1));
	dedicatedlog.debug(`Problematic modules are ${problematic.map(x => moduleNames.get(x))}`);
	

	// Split any modules with more than one problem into several modules with one problem each
	let toDelete = [];
	let toAdd = [];
	for (let problem of problematic) {
		// Get the keys of all component that have a length > 1
		let problematicComponentKeys = Object.keys(problem.components).filter(componentKey => problem.components[componentKey].length > 1);
		// If the array of key names is itself longer than 1, this problematic module must be split
		if (problematicComponentKeys.length > 1) {
			dedicatedlog.debug(`Module ${moduleNames.get(problem)} has more than one problem: ${problematicComponentKeys}. Splitting.`);
			// Mark the module for deletion
			toDelete.push(problem);
			// Construct new problems for each problematic component
			for (let problematicComponentKey of problematicComponentKeys) {
				// Make a deep copy
				let newProblem = clone(problem);
				moduleNames.set(newProblem, moduleNames.get(problem));
				// Then delete all problematic components except one
				for (let otherKey of problematicComponentKeys.filter(component => component !== problematicComponentKey)) {
					dedicatedlog.debug(`Deleting ${otherKey} which is ${JSON.stringify(newProblem.components[otherKey])}`)
					delete newProblem.components[otherKey];
				}
				// Mark the new problem for addition
				toAdd.push(newProblem);
				dedicatedlog.debug(`Created problem ${problematicComponentKey} for ${moduleNames.get(newProblem)}`);
			}
		}				
	}
	problematic = problematic.filter(problem => !toDelete.includes(problem));
	problematic = problematic.concat(toAdd);

	// Now try to find remedies for the problematic modules.
	for (let problem of problematic) {
		let problematicComponentKey = Object.keys(problem.components).filter(key => problem.components[key].length > 1);
		let problematicComponent = problem.components[problematicComponentKey];
		dedicatedlog.debug(`For ${moduleNames.get(problem)} problem narrowed down to ${problematicComponentKey} which is ${problematicComponent}`);

		// The ucTypes of all modules that have a definition for the problem field.
		// This is so that we don't consider more than one module of a specific
		// ucType
		// Initialize to the problematic module's ucType, obviously we can't equip
		// any more of this type anyway.
		let contributors = [ problem.ucType ];
		// For every module			
		for (let module of modules) { // eslint-disable-line no-global-assign
			// Only look at modules that have not contributed yet
			if (contributors.includes(module.ucType)) continue;

			// If this module contains a definition pertaining to the 
			// problematic component
			if (problematicComponentKey in module.components) {
				// Intersect problematicComponent with the entries for the problematic
				// component in that module
				problematicComponent = arrayIntersect(problematicComponent, module.components[problematicComponentKey]);
				// Add the module's ucType to the list of contributors, because we
				// have "equipped" it now.
				contributors.push(module.ucType);
				dedicatedlog.debug(`Found module ${moduleNames.get(module)} that has a definition for ${problematicComponentKey}. Problematic component is now ${problematicComponent}`);
			}
			// If that narrowed it down to length 1, we're done with this problem
			if (problematicComponent.length === 1) {
				dedicatedlog.debug(`Problem solved for ${moduleNames.get(problem)} ${problematicComponentKey}`)
				break;						
			}
		}
		if (problematicComponent.length > 1) {
			if (moduleComponentsResolveUnambiguously.IGNORE.includes(ship.name)) {
				if (!ignoredWarnings.includes(ship.id)) {
					ignoredWarnings.push(ship.id);
					rootlog.warn(`Ignored failed invariant "all modules' components must resolve unambiguously" for known violator ${ship.name}`);
				}
			} else
				counterexamples.push(`${ship.name}.ShipUpgradeInfo.${moduleNames(problem)}.${problematicComponentKey}`);
		}
	}

	if (counterexamples.length > 0) {
		let errors = counterexamples.map(counterexample => new InvariantError('all modules\' components must be resolvable unambiguously', counterexample));
		throw errors.length > 1 ? new AggregateError(errors) : errors[0];
	}
}
// Known violators to be ignored
moduleComponentsResolveUnambiguously.IGNORE = [ 'PASA110_Midway' ];

export function weaponAmmosAreOrdered(ship) {
	if (ship.typeinfo?.type !== 'Ship') return;

	/*
		This algorithm works as follows:
		For every ship, it looks at every top-level object defined within that ship and finds any objects
		contained therein that have a typeinfo with typeinfo.type === 'Gun'. 
		It then checks that each of the found guns' ammoList is in the same order.
		By iterating over the top-level objects instead of just finding guns directly on the ship, it
		allows for the order to vary across modules, but makes sure that within a module the order is
		the same for all guns. 
		E.g. if a ship has two artillery modules (AB1_Artillery and AB2_Artillery), and all guns within
		AB1_Artillery have ammo lists that order the HE shell first and the AP shell second, even though
		the order is the other way around for all guns in AB2_Artillery that is okay.
		But if one gun in AB1_Artillery has the order HE-AP and one gun has the order AP-HE, that is not okay.
	 */
	
	// Helper function to find all descendant (including deeply nested) objects within data that have a 
	// typeinfo.type property equal to 'Gun'.
	function findGuns(data) {
		let objects = Object.values(data).filter(item => 
					typeof item === 'object' // This includes arrays
					&& item !== null);  // Because typeof null === 'object'
		let result = objects.filter(obj => obj.typeinfo?.type === 'Gun');
		result.concat(objects.map(findGuns));
		return result;
	}

	let dedicatedlog = rootlog.getLogger('assertInvariants');
	let counterexamples = [];

	dedicatedlog.debug(`Checking invariant assertWeaponAmmosAreOrdered for ${ship.name}`);		
	// Iterate over ship's top level objects. This will scope found guns to those top-level objects,
	// ultimately causing the invariant to only fail if ammos are out of order WITHIN a module's 
	// guns.
	// E.g. if a ship's stock artillery has a different order from that ship's top artillery, this
	// will not violate the invariant, but if two different turrets within the same artillery module
	// have different orders for the ammos it will.
	for (let key of Object.keys(ship)) {
		let obj = ship[key];
		// Filter out primitives and null values (because typeof null === 'object')
		if (typeof obj !== 'object' || obj === null) continue;

		let ammos = {};
		let guns = findGuns(obj);
		if (guns.length > 0) dedicatedlog.debug(`${ship.name}.${key} has ${guns.length} guns`);
		for (let gun of guns) {
			let gunKey = Object.keys(obj).find(key => obj[key] === gun);
			dedicatedlog.debug(`Gun ${gunKey} has ${gun.ammoList ? 'ammos ' + gun.ammoList : 'no ammos'}`);
			// Iterate over all ammos for that gun
			for (let i = 0; i < gun.ammoList?.length; i++) {
				let ammo = gun.ammoList[i];
				// Is this a new ammo? If so, remember its index
				if (!(ammo in ammos))
					ammos[ammo] = i;
				// If it is a known ammo, check that it's at the same index as remembered
				else if (ammos[ammo] !== i)
					counterexamples.push(`${ship.name}.${key}.${gunKey} has ammo ${ammo} at index ${i}, but it was expected at index ${ammos[ammo]}`);
			}
		}
	}

	if (counterexamples.length > 0) {
		let errors = counterexamples.map(counterexample => new InvariantError('a ship\'s weapon ammos must always be in the same order', counterexample));
		throw errors.length > 1 ? new AggregateError(errors) : errors[0];
	}
}