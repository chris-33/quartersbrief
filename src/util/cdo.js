import { arrayEqual } from './util.js';
import util from 'util';
import chalk from 'chalk';

/**
 * @class ComplexDataObject
 */
class ComplexDataObject {
	#data;

	/** 
	 * Creates a new `ComplexDataObject` over a copy of the provided data. Any
	 * nested properties of `data` that are not primitives will likewise be
	 * turned into `ComplexDataObject`s.
	 * 
	 * @param  {*} data The `data` for the `ComplexDataObject`.
	 */
	constructor(data) {
		// If data is already a ComplexDataObject, copy all its values it.
		if (data instanceof ComplexDataObject) {
			this.#data = {};
			data.keys().forEach(key => this.#data[key] = data.get(key));
		} else
			// Otherwise make a shallow copy.
			this.#data = Object.assign({}, data);

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
			(prev, key) => prev && this.get(key) instanceof ComplexDataObject ? this.#data[key].equals(other.get(key)) : this.get(key) === other.get(key), true
		);
	}

	/**
	 * Returns the set of keys this `ComplexDataObject` has.
	 * @return {String[]} The keys this CDO has.
	 */
	keys() { return Object.keys(this.#data); }
	values() { return this.keys().map(this.get); }

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
			.map(key => this.#data[key]);
		if (path.length > 0)
			result = result.map(x => x.get(path.join('.')));

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
		return `${chalk.blue(this.constructor.name)} ${util.inspect(this.#data, options)}`;
	}

	/**
	 * Clones this `ComplexDataObject`.
	 * @return {ComplexDataObject} A new `ComplexDataObject` that has exactly the same data as this one.
	 */
	clone() {
		return new ComplexDataObject(this.#data);
	}


	// /**
	//  * Multiplies the value that is stored under the provided key name with `factor`. 
	//  * This method supports the same options and key notation rules as {@link ComplexDataObject#apply}.
	//  *
	//  * It is a shorthand for `apply(key, (x) => x * factor, options)`.
	//  * @memberof ComplexDataObject
	//  * @instance
	//  * @see ComplexDataObject#apply
	//  */
	// multiply(key, factor, options) {
	// 	return this.apply(key, (x) => x * factor, options);
	// }

	// /**
	//  * Gets the value that is stored under the provided key name. This method
	//  * supports the same options and key notation rules as {@link ComplexDataObject#apply}.
	//  *
	//  * It is a shorthand for `apply(key, (x) => x, options)`.
	//  * @memberof ComplexDataObject
	//  * @instance
	//  * @see ComplexDataObject#apply
	//  */
	// get(key,options) {
	// 	return this.apply(key, function identity(x) { return x; }, options);
	// }

	// /**
	//  * Sets the value that is stored under the provided key name, if any, to the supplied
	//  * value. This method supports the same options and key notation rules as {@link ComplexDataObject#apply}.
	//  *
	//  * It is a shorthand for `apply(key, (x) => value, options)`.
	//  *
	//  * @memberof ComplexDataObject
	//  * @instance
	//  * @see ComplexDataObject#apply
	//  */
	// set(key, value, options) {
	// 	return this.apply(key, function assign() { return value; }, options);
	// }

	// *
	//  * Applies the passed function to any (possibly deeply nested) property of the object, 
	//  * and returns the result. This provides a simple but powerful tool to make manipulating 
	//  * values that are possibly deeply embedded in a data object easy. Getting and setting values
	//  * are then just special cases of this, by providing the identity function (that always returns
	//  * its argument) or a constant function (that always returns a constant regardless of its
	//  * argument), respectively. This method supports dot notation, wildcards, and result
	//  * collation.
	//  *
	//  * **Dot notation**
	//  * The key supports dot notation to gain access to nested properties and
	//  * array entries. To manipulate array elements, array indices need to be 
	//  * expressed in dot notation as well.
	//  *
	//  * Examples, where `obj` is an `ComplexDataObject`:
	//  * - `prop` refers to the property named "prop" of `obj` (`obj.prop`).
	//  * - `nested.prop` refers to the property named "prop" of a property named
	//  * "nested" of `obj` (`obj.nested.prop`).
	//  * - `arr.0` refers to the element at index 0 of an array property named "arr"
	//  * of `obj` (`obj.arr[0]`).
	//  * - Similarly, `arr.0.prop` refers to a property named prop of the element
	//  * at index 0 of an array property "arr" of `obj` (`obj.arr[0].prop`).
	//  *
	//  * **Wildcards**
	//  * Furthermore, the key supports wildcards. Thus, an asterisk in any part
	//  * of a key name will match an arbitrary number of characters, underscores,
	//  * or digits. Note that when accessing nested properties after a wildcard,
	//  * **all** properties that matched for the wildcard are expected to have 
	//  * subsequent properties. If this is not the case, an error will be thrown.
	//  *
	//  * Examples, where `obj` is an `ComplexDataObject`:
	//  * - `prop` matches only the property named "prop" of `obj`
	//  * - `prop*` matches _any_ property whose name starts with "prop". For example,
	//  * `prop1`, `prop2`, `propA`, `propB` all match.
	//  * - `prop*suffix` matches any property whose name starts with "prop" and ends
	//  * with "suffix", with an arbitrary number of letters, digits and underscore in
	//  * between. 
	//  * `nested*.prop` matches the property "prop" of _any_ property of `obj` whose
	//  * name starts with "nested". In strict mode, all of these are expected to have such 
	//  * a property, otherwise an error will be thrown. 
	//  *
	//  * **Result collation**
	//  * If you are expecting the results to all be the same, `apply` can return that
	//  * value as a scalar. This will frequently be the case when the values that `fn`
	//  * was applied to were all equal to begin with, assuming `fn` is a 
	//  * [pure function](https://en.wikipedia.org/wiki/Pure_function). **This is therefore
	//  * the default behavior.** `apply` will then perform a final check that all
	//  * values were indeed equal (more specifically, deeply equal), and throw an error
	//  * if they were not. Note that `fn` will still be applied to all properties
	//  * that matched `key` regardless.
	//  * 
	//  * Scalar return of expected equal results can be be turned off by passing an
	//  * `options` object that has `options.collate` set to `false`. In this case,
	//  * `apply` will return an array with the results of the function applications,
	//  * even if only a single property matched.
	//  *
	//  * Setting it to `false` will _always_ return an array - even if the 
	//  * key did not contain any wildcards at all. In that case, an array with a 
	//  * single value is returned.
	//  * 
	//  * @param {string} key   The key of the property to apply `fn` to. By using wildcards, 
	//  * multiple properties can be selected.
	//  * @param {Function} fn The function to apply to the property's (or properties') value(s). 
	//  * This must be a function that accepts a single argument and returns a value. 
	//  * @param {Object} [options={collate: true, strict: true}] An optional options object.
	//  * @param {boolean} options.collate=true	Whether to return the results of the 
	//  * function application as a single value or as an array.
	//  * @param {boolean} [options.strict=true] Whether to error if nothing matches or just ignore. The default is false. 
	//  * @throws
	//  * Throws an error if the requested property or any intermediate properties do
	//  * not exist, and `options.strict` is `true`.
	//  * @throws
	//  * Throws an error if `options.collate` is `true` but the results of the function application
	//  * to all matched properties are not equal (deeply equal).
	//  * @memberof ComplexDataObject
	//  * @instance
	 
	// apply(key, fn, options = { /* defaults will be set in method */ }) {			
	// 	let self = this;

	// 	// Set default values, if they are not set
	// 	options.collate ??= true;
	// 	options.strict ??= true;

	// 	// Split the key into its parts. These can be thought of as "path elements"
	// 	// to traverse along the data object
	// 	let path = key.split('.');
	// 	let targets = [ self ];
		
	// 	while(path.length > 0) { 
	// 		let currKey = path.shift(); // Remove first element							
	// 		// Turn the current key into a regular expression by replacing the asterisk with its regex equivalent
	// 		let currKeyRegex = new RegExp(`^${currKey.replace('*', '\\w*')}$`);

	// 		// For every target ...
	// 		targets = targets.flatMap(target => {
	// 			// ... get a list of its keys that match the currKey. This will be an array of
	// 			// just one (or zero) key(s) if currKey does not contain wildcards.
	// 			let matches = Object.keys(target).filter(key => currKeyRegex.test(key));
	// 			// If that key doesn't exist in the object and we are in strict mode, throw an error
	// 			if (matches.length === 0 && options.strict) {
	// 				throw new Error(`Trying to apply fn to unknown property ${key} of ${self} in strict mode`);
	// 			} else
	// 				// If there were matches, either traverse if this is an intermediate level,
	// 				// or apply the function to its value if we are at the end
	// 				// If there were no matches, this will just return an empty array which will be
	// 				// nuked by flatMap()
	// 				return matches.map(match => path.length > 0 ? target[match] : target[match] = fn(target[match]));
	// 		});
	// 	}
	// 	if (options.collate) {
	// 		if (!targets.every(target => deepequal(target, targets[0])))
	// 			throw new Error(`Expected all values to be equal while collating but they were not: ${targets}`);
	// 		// We can just project to the first item, since we just checked that they're
	// 		// all equal anyway
	// 		targets = targets[0];
	// 	}
	// 	return targets;			
	// }

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