import { arrayEqual } from './util.js';
import util from 'util';
import chalk from 'chalk';
import clone from 'just-clone';

/**
 * @class ComplexDataObject
 */
class ComplexDataObject {
	#data;
	#coefficients;

	/**
	 * This method mirrors some Array functions to make working with CDOs over arrays easier. The mirrored functions are:
	 * `concat`, `every`, `filter`, `find`, `findIndex`, `flat`, `flatMap`, `forEach`, `indexOf`, `join`, `map`, `reduce`, some`.
	 * Notably missing from this list are `push`, `pop`, `shift`, `unshift` and `sort`. These are intentionally not mirrored,
	 * because they change the contents of the underlying array.
	 *
	 * The above methods are mirrored in a way that ensures that any coefficients registered on the array's contents will be applied.
	 */
	#arrayify() {
		const MIRROR = [
			'concat', 'every', 'filter', 'find', 'findIndex', 'flat', 'flatMap', 'forEach', 'indexOf', 'join', 'map', 'reduce', 'some'
			// Not exposing push, pop, shift, unshift, sort because it those change the array, and CDOs are supposed to be immutable
		];
		for (let prop of MIRROR) {
			let desc = Object.getOwnPropertyDescriptor(Array.prototype, prop);
			Object.defineProperty(this, prop, { ...desc, value: (...args) => {
				// Create a proxy to intercept read operations on the array and turn them into calls to cdo.get()
				let proxy = new Proxy(this.#data, {
					get: (target, property) => {
						// Typecheck for symbols first, because trying to coerce a symbol to a string is a TypeError
						// Then, if the requested property can be parsed into a number, this means the mirrored method was 
						// accessing the array contents. Change that call to the CDO's get() method to allow registered
						// coefficients to be applied.
						if (typeof property !== 'symbol' && !Number.isNaN(Number.parseInt(property))) {
							return this.get(property);
						}
						// Otherwise just return the requested property
						return target[property];
					}
				});
				// Apply the mirrored method on the proxy with the original arguments
				return proxy[prop].apply(proxy, args);
			}});
		}
	}

	/** 
	 * Creates a new `ComplexDataObject` over a copy of the provided data. Any
	 * nested properties of `data` that are not primitives will likewise be
	 * turned into `ComplexDataObject`s. 
	 *
	 * If `data` is an array, the resulting `ComplexDataObject` will mirror the following methods:
	 * `concat`, `every`, `filter`, `find`, `findIndex`, `flat`, `flatMap`, `forEach`, `indexOf`, `join`, `map`, `reduce`, some`.
	 * These behave as their counterparts from `Array.prototype`, but ensure that registered coefficients are correctly
	 * applied.
	 * 
	 * @param  {*} data The `data` for the `ComplexDataObject`.
	 */
	constructor(data) {
		this.#coefficients = {};

		// If data is already a ComplexDataObject, copy all its values it.
		if (data instanceof ComplexDataObject) {
			this.#data = {};
			data.keys().forEach(key => this.#data[key] = data.get(key));
		} else
			// Otherwise make a shallow copy of the object/array.
			this.#data = Array.isArray(data) ? [ ...data ] : { ...data };

		// If data is an array, mirror Array.prototype methods on the CDO
		if (Array.isArray(data)) this.#arrayify();

		// Recursively turn any object properties of the data into CDOs.
		// If a property is already a CDO, clone it (otherwise, copying them
		// will result in all data being lost because it is private).
		for (let key in this.#data)			
			if (typeof this.#data[key] === 'object' && this.#data[key] !== null)
				if (this.#data[key] instanceof ComplexDataObject)
					this.#data[key] = this.#data[key].clone();
				else
					this.#data[key] = new ComplexDataObject(this.#data[key]);
	}

	/**
	 * Returns the set of keys this `ComplexDataObject` has.
	 * @return {String[]} The keys this CDO has.
	 */
	keys() { return Object.keys(this.#data); }
	values() { return this.keys().map(key => this.get(key)); }

	/**
	 * Gets the values of the (possibly deeply nested) property of the object identified by `key`. 
	 * This method supports dot notation, wildcards, and result collation.
	 *
	 * **Dot notation**
	 * The key supports dot notation to gain access to nested properties and
	 * array entries. To manipulate array elements, array indices need to be 
	 * expressed in dot notation as well.
	 *
	 * Examples, where `obj` is an `ComplexDataObject`:
	 * - `prop` refers to the property named "prop" of `obj` (`obj.prop`).
	 * - `nested.prop` refers to the property named "prop" of a property named
	 * "nested" of `obj` (`obj.nested.prop`).
	 * - `arr.0` refers to the element at index 0 of an array property named "arr"
	 * of `obj` (`obj.arr[0]`).
	 * - Similarly, `arr.0.prop` refers to a property named prop of the element
	 * at index 0 of an array property "arr" of `obj` (`obj.arr[0].prop`).
	 *
	 * **Wildcards**
	 * Furthermore, the key supports wildcards. Thus, an asterisk in any part
	 * of a key name will match an arbitrary number of characters, underscores,
	 * or digits. 
	 *
	 * Examples, where `obj` is an `ComplexDataObject`:
	 * - `prop` matches only the property named "prop" of `obj`
	 * - `prop*` matches _any_ property whose name starts with "prop". For example,
	 * `prop1`, `prop2`, `propA`, `propB` all match.
	 * - `prop*suffix` matches any property whose name starts with "prop" and ends
	 * with "suffix", with an arbitrary number of letters, digits and underscore in
	 * between. 
	 *
	 * **Result collation**
	 * If you are expecting the property values to all be the same, `get` can return that
	 * value as a scalar. It will perform a check that this is indeed the case, and throw 
	 * an error if they were not. Equality is determined by using strict equality (`===`) for
	 * primitives, and calling `{@link ComplexDataObject#equals}` for `ComplexDataObject`s.
	 * 
	 * The default is to return a scalar when `key` contains no wildcards, and an array if it does.
	 * It can be overridden by setting the `collate` property of the `options` object.
	 *
	 * @param {string} key   The key of the property to get. By using wildcards, 
	 * multiple properties can be selected.
	 * @param {Object} [options] An optional options object that can have the following properties:
	 * - `collate`: Whether to return the gotten property values as an array (`false`) or a primitive (`true`). 
	 * Defaults to `false` if `key` contains wildcards and to `true` if it doesn't.
	 * @throws
	 * Throws an error if `options.collate` is `true` but the values of all matched properties are not equal. Equality
	 * is strict equality for primitives and determined by calling `.equals()` for `ComplexDataObject`s.
	 * @memberof ComplexDataObject
	 * @instance
	 */
	get(key, options) {
		let path = key.split('.');
		
		options ??= {};
		options.collate ??= !key.includes('*');

		let currKeyRegex = new RegExp(`^${path.shift().replace('*', '\\w*')}$`);
		let result = this.keys()
			.filter(key => currKeyRegex.test(key))
			// Apply all coefficients to #data[key], or if #coefficients[key] == undefined return #data[key]
			.map(key => (this.#coefficients[key])?.reduce((prev, coeff) => prev * coeff, this.#data[key]) ?? this.#data[key]);
		if (path.length > 0)
			result = result.flatMap(x => x.get(path.join('.')));

		if (options.collate) {
			if (!result.every(res => res instanceof ComplexDataObject ? res.equals(result[0]) : res === result[0]))
				throw new Error(`Expected all values to be equal while collating but they were not: ${result}`);
			// We can just project to the first item, since we just checked that they're
			// all equal anyway
			result = result[0];
		}

		return result;
	}

	// Override how CDOs are displayed in console.log.
	// See https://nodejs.org/api/util.html#custom-inspection-functions-on-objects
	[util.inspect.custom](depth, options) {
		return `${chalk.blue(this.constructor.name)} ${util.inspect(this.#data, options)}\nCoefficients: ${util.inspect(this.#coefficients, options)}`;
	}

	/**
	 * Checks this CDO for equality with another. Two CDOs are considered equal if and only if
	 * - both are instances of `ComplexDataObject`,
	 * - they have the same keys as returned by `keys()`,
	 * - any primitive properties are strictly equal to each other,
	 * - any complex properties are equal to each other, as determined by calling `equals` recursively.
	 * @param  {*} other The value to compare this `ComplexDataObject` to.
	 * @return {boolean} `true` if the above conditions listed above are met, `false` otherwise.
	 */
	equals(other) {
		if (!(other instanceof ComplexDataObject)) return false;

		if (!arrayEqual(this.keys(), other.keys())) return false;

		return this.keys().reduce(
			(prev, key) => {
				let curr = this.get(key);
				return prev && (curr instanceof ComplexDataObject ? curr.equals(other.get(key)) : curr === other.get(key))
			}, true);
	}

	/**
	 * Clones this `ComplexDataObject`, including any registered coefficients.
	 * @return {ComplexDataObject} A new `ComplexDataObject` that has exactly the same data and coefficients as this one.
	 */
	clone() {
		let cdo = new ComplexDataObject(this.#data);
		cdo.#coefficients = clone(this.#coefficients);
		return cdo;
	}

	/**
	 * Gets a fresh copy of this `ComplexDataObject`: A clone without registered coefficients.
	 * @return {ComplexDataObject} A new `ComplexDataObject` that has exactly the same data as this one and no coefficients.
	 */
	replicate() {
		let cdo = this.clone();
		cdo.unmultiplyAll();
		return cdo;
	}

	/**
	 * Gets a hash of all coefficients registered on this `ComplexDataObject`, including those for nested properties.
	 * @return {Object} A hash where keys are properties and values are arrays of registered coefficients. Nested 
	 * properties are expressed in dot notation.
	 */
	coefficients() {
		let coefficients = clone(this.#coefficients);
		for (let key of this.keys()) {
			if (this.#data[key] instanceof ComplexDataObject) {
				let childcoeffs = this.#data[key].coefficients();
				for (let childKey in childcoeffs) {
					coefficients[`${key}.${childKey}`] = childcoeffs[childKey];
				}
			}
		}
		return coefficients;
	}

	/**
	 * Registers all coefficients in the passed `coefficients` object.
	 * @param  {Object} coefficients The coefficients to register. This parameter is a hash where keys are the
	 * `ComplexDataObject`'s keys to register coefficients on (supporting dot notation and wildcards), and their
	 * values are arrays of the coefficients to register.
	 */
	multiplyAll(coefficients) {
		for (let key in coefficients) 
			coefficients[key].forEach(coeff => this.multiply(key, coeff));
	}

	/**
	 * Registers a new coefficient to be applied any time `key` is read. `key` may refer to a nested property using
	 * dot notation, and supports wildcards.
	 *
	 * Example:
	 * @example
	 * let cdo = new ComplexDataObject({ a: 2 });
	 * cdo.get('a'); // 2
	 * cdo.multiply('a', 3);
	 * cdo.get('a') // 6
	 * @param  {String} key   The key for which to register a coefficient. Can include dot notation and wildcards.
	 * @param  {Number} coeff The coefficient to register.
	 */
	multiply(key, coeff) {
		let path = key.split('.');
		let currKeyRegex = new RegExp(`^${path.shift().replace('*', '\\w*')}$`);
		let keys = this.keys().filter(key => currKeyRegex.test(key));

		if (path.length === 0) 
			keys.forEach(key => {
				this.#coefficients[key] ??= [];
				this.#coefficients[key].push(coeff);
			});
		else
			keys.forEach(key => this.#data[key].multiply(path.join('.'), coeff));
	}

	/**
	 * Unregister a coefficient. If `coeff` wasn't previously registered on `key`, does nothing.
	 * If `coeff` was registered more than once, only one instance is removed.
	 * @param  {String} key   The key from which to unregister the coefficient.
	 * @param  {Number} coeff The coefficient to unregister.
	 */
	unmultiply(key, coeff) {
		let path = key.split('.');
		let currKeyRegex = new RegExp(`^${path.shift().replace('*', '\\w*')}$`);
		let keys = this.keys().filter(key => currKeyRegex.test(key));

		if (path.length === 0) 
			keys.forEach(key => {
				let index = this.#coefficients[key]?.indexOf(coeff);
				if (index !== -1) this.#coefficients[key]?.splice(index, 1);
			})
		else 
			keys.forEach(key => this.#data[key].ummultiply(path.join('.'), coeff));
	}

	/**
	 * Unregisters all coefficients, including on child objects.
	 */
	unmultiplyAll() {
		this.#coefficients = {};
		for (let key in this.#data)
			if (this.#data[key] instanceof ComplexDataObject)
				this.#data[key].unmultiplyAll();
	}

	/**
	* This function defines getter functions on the object for the definitions
	* in `definitions`. `definitions` must be an object where all values all either strings or functions.
	*
	* For each key-value pair (property, definition) in `definitions`, the object will get a method named `get` + `property`.
	* If the `definition` is a string, the method will return the value of the property with that name by calling
	* `obj.get(definition)`. If `definition` is a function, the method will be that function with "this" bound to `obj`.
	* @param  {Object} obj        The object for which to create getters. It must support reading of definitions using
	* `get(name)`. Most commonly this will be a `GameObject`.
	* @param  {Object} definitions An object of key-value pairs for the properties to create getters for. 
	*/
	static createGetters = function(obj, definitions) {
		for (let property in definitions) {
			let getter;
			switch (typeof definitions[property]) {
				case 'string': 
					// If the lookup definition is a string, it is the name of a property 
					// to look up
					getter = function() { return obj.get(definitions[property]); }
					break;
				case 'function':
					// If the lookup definition is a function, it is the function to use for 
					// looking up that property. Use that function, binding "this" to this GameObject.
					getter = definitions[property].bind(obj);
					break;
			}
			// Make the getter non-enumerable
			Object.defineProperty(obj, 'get' + property, {
				enumerable: false,
				value: getter
			});
		}
	}
}

export { ComplexDataObject }