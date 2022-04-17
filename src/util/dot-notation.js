import { GameObject } from '../model/gameobject.js';

export default class DotNotation {
	constructor(data) {
		this.data = data;
	}

	/**
	 * Resolves a single step by returning all properties that match `prop` in `base`. Supports wildcards,
	 * but not dot notation.
	 * @param  {String} prop The properties to select. May contain wildcards.
	 * @param  {Object} [base] The base object to select from. If not specified, defaults to `this.data`.
	 * @return {Array} An array of all properties in `base` that matched `prop`. Even if `prop` was a simple
	 * key, the result is still an array.
	 */
	resolveStep(prop, base) {
		return this.applyFn(prop, x => x, base);
	}

	/**
	 * Applies `fn` to all properties in `base` that match `key`.
	 * @param  {String}   prop The properties to apply `fn` to. May contain wildcards.
	 * @param  {Function} fn   The function to apply.
	 * @param  {Object}   [base] The object to work on. If not specified, defaults to `this.data`.
	 * @return {Array}       An array containing the results of the function application.
	 */
	applyFn(prop, fn, base) {
		base ??= this.data;
		let keyRegex = new RegExp(`^${prop.replace('*', '\\w*')}$`);
		if (base instanceof GameObject) base = base._data;
		return Object.keys(base)
			.filter(key => keyRegex.test(key))
			.map(key => base[key] = fn(base[key])); // Assignments are expressions in JavaScript
	}

	/**
	 * Resolves all except the last step.
	 * @param  {String} key The properties to select. May contain wildcards and dot notation.
	 * @return {Array} An array of all the objects that contain the last path element of `key`.
	 * @example
	 * const ex = {
	 * 	o1: {
	 * 		a: 1
	 * 	},
	 * 	o2: {
	 * 		a: 2,
	 * 		b: {
	 * 			c: 0
	 * 		}
	 * 	}
	 * }
	 * let dn = new DotNotation(ex);
	 * dn.resolveToParents('o1.a'); // [ ex.o1 ]
	 * dn.resolveToParents('o2.a'); // [ ex.o2 ]
	 * dn.resolveToParents('o2.b.c'); // [ ex.o2.b ]
	 * dn.resolveToParents('o*.a'); // [ ex.o1, ex.o2 ]
	 */
	resolveToParents(key) {
		let path = key.split('.');
		let targets = [ this.data ];
		// Remove the last element, because we are only resolving to the containing parent objects
		path.pop();
		while (path.length > 0) {
			let currKey = path.shift();
			targets = targets.flatMap(this.resolveStep.bind(this, currKey));
		}
		return targets;
	}
}

DotNotation.Key = class {
	constructor(key) {
		this.key = key;
	}

	get path() { 
		let lastdot = this.key.lastIndexOf('.');
		if (lastdot > -1)
			return this.key.substring(0, lastdot);
		else return '';
	}

	get prop() {
		let lastdot = this.key.lastIndexOf('.');
		if (lastdot > -1)
			return this.key.substring(lastdot + 1)
		else return this.key;
	}

	isComplex() {
		return this.key.includes('*');
	}
}