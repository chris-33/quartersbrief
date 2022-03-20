import deepequal from 'deep-equal';
import { cloneProperties } from '../util/util.js';

const originals = Symbol('originals');

/**
 * @class ComplexDataObject
 * @description `ComplexDataObject`s are the main building block of this program's model objects and
 * are intended to make working with large, deeply-nested model definitions easier. They
 * provide methods to retrieve such data ({@link ComplexDataObject#get}), and to apply coefficients
 * to their values ({@link ComplexDataObject#multiply}).
 *
 * Any array or plain-old-object properties of a `ComplexDataObject` are likewise `ComplexDataObject`s.
 *
 * Note that `ComplexDataObject`s are not intended to be instantiated with the `new` keyword. They are 
 * "instantiated" by calling {@link cdo}, which will set the source's prototype to `ComplexDataObject`.
 */

/*
	Even though the documentation counsels that setting the prototype is a slow operation,
	it turns out that it is still significantly faster than defining all methods directly
	on the data. (Setting the prototype only takes about half as long, and this margin can
	be expected to increase as more methods are added.)

	This was starting to become a performance bottleneck.
 */
/**
 * The prototype for `ComplexDataObject`s.
 * @lends ComplexDataObject
 */
const ComplexDataObject = {
	/**
	 * @memberof ComplexDataObject
	 * @instance
	 * @description Multiplies the value that is stored under the provided key name with `factor`. 
	 * This method supports the same key notation rules as {@link ComplexDataObject#get}.
	 *
	 * @param  {String} key    The key whose value to multiply. Supports dot notation and 
	 * wildcards.
	 * @param  {Number} factor The factor to apply to the value.
	 */
	multiply: function(key, factor) {
		let path = key.split('.');
		let currKeyRegex = new RegExp(`^${path.shift().replace('*', '\\w*')}$`);
		let targets = Object.keys(this).filter(key => currKeyRegex.test(key));

		if (path.length === 0)
			targets.forEach(target => {
				if (!(target in this[originals]))
					this[originals][target] = this[target];
				this[target] *= factor
			});
		else 
			targets.forEach(target => this[target].multiply(path.join('.'), factor));				
	},
	/**
	 * @memberof ComplexDataObject
	 * @instance
	 * @description Undoes multiplication of `factor` onto the property `key`. It is the same as 
	 * calling `multiply(key, 1 / factor)`.
	 * @see ComplexDataObject#multiply
	 */
	unmultiply: function(key, factor) {
		let path = key.split('.');
		let currKeyRegex = new RegExp(`^${path.shift().replace('*', '\\w*')}$`);
		let targets = Object.keys(this).filter(key => currKeyRegex.test(key));
		if (path.length === 0)
			targets.forEach(target => this[target] /= factor);
		else 
			targets.forEach(target => this[target].unmultiply(path.join('.'), factor));				
	},
	/**
	 * @memberof ComplexDataObject
	 * @instance
	 * @description Clears any prior multiplications from this `ComplexDataObject`. Afterwards, it
	 * will be in its original state.
	 * @see ComplexDataObject#multiply
	 */
	clear: function() {
		const descs = Object.getOwnPropertyDescriptors(this);
		for (let prop in descs) {
			const desc = descs[prop];
			if (typeof desc.value === 'object' && desc.value !== null && typeof desc.value.clear === 'function') 
				desc.value.clear();
			else if (typeof desc.value === 'number')
				this[prop] = this[originals][prop] ?? this[prop];
		}
	},
	/**
	 * @memberof ComplexDataObject
	 * @instance
	 * @description Retrieves the value stored under the provided key name. This method supports
	 * dot notation, wildcards, and result collation.
	 * 
	 * **Dot notation**
	 * The key supports dot notation to gain access to nested properties and
	 * array entries. To manipulate array elements, array indices need to be 
	 * expressed in dot notation as well.
	 *
	 * Examples, where `obj` is a `ComplexDataObject`:
	 * - `prop` refers to the property named "prop" of `obj` (`obj.prop`).
	 * - `nested.prop` refers to the property named "prop" of a property named
	 * "nested" of `obj` (`obj.nested.prop`).
	 * - `arr.0` refers to the element at index 0 of an array property named "arr"
	 * of `obj` (`obj.arr[0]`).
	 * - Similarly, `arr.0.prop` refers to a property named prop of the element
	 * at index 0 of an array property "arr" of `obj` (`obj.arr[0].prop`).
	 *
	 * **Wildcards**
	 * Furthermore, the key supports wildcards: An asterisk in any part
	 * of a key name will match an arbitrary number of characters, underscores,
	 * or digits. 
	 *
	 * Note: if the key contains at least one wildcard, collation will be on by default.
	 *
	 * Examples, where `obj` is a `ComplexDataObject`:
	 * - `prop` matches only the property named "prop" of `obj`
	 * - `prop*` matches _any_ property whose name starts with "prop". For example,
	 * `prop1`, `prop2`, `propA`, `propB` all match.
	 * - `prop*suffix` matches any property whose name starts with "prop" and ends
	 * with "suffix", with an arbitrary number of letters, digits and underscore in
	 * between. 
	 * `nested*.prop` matches the property "prop" of _any_ property of `obj` whose
	 * name starts with "nested". 
	 *
	 * **Result collation**
	 * If you are expecting the results to all be the same, `get` can return that
	 * value as a scalar. In this case, `get` will perform a final check that all
	 * values were indeed equal (more specifically, deeply equal), and throw an error
	 * if they were not. If the check succeeded, it then returns that value.
	 * 
	 * Scalar return of expected equal results can be controlled by passing the `collate`
	 * key of the passed `options` object. The default behavior is to collate, unless the 
	 * key contained at least one wildcard. If `collate` is set to `false`,
	 * `get` will _always_ return an array, even if only a single property matched.
	 * 
	 * @param {string} key   The key of the property to get. By using wildcards, multiple
	 * properties can be selected.
	 * @param  {Object} [options] Additional options for the operation.
	 * @param {boolean} [options.collate] Turn collation on or off specifically. The default
	 * is `false` if `key` contains at least one wildcard, and `true` otherwise.
	 * @return {*}         The data for all properties that matched the `key`.
	 * @throws
	 * Throws an error if `options.collate` is `true` but the values of the matched properties 
	 * are not equal (more specifically, deeply equal).
	 */
	get: function(key, options) {
		options ??= {};
		options.collate ??= !key.includes('*');

		let path = key.split('.');
		let currKeyRegex = new RegExp(`^${path.shift().replace('*', '\\w*')}$`);
		let targets = Object.keys(this)
			.filter(key => currKeyRegex.test(key));

		// If this is the destination property, get it for every target. Otherwise, call get
		// recursively with the rest of the path. In this case, we must use flatMap and 
		// turn off collation. This is to make sure that collating does not flatten
		// array properties, and that not collating does not produce deeply nested arrays
		// (i.e. arrays of arrays of arrays of ... - this is what would happen with .map())
		if (path.length > 0)
			targets = targets.flatMap(target => this[target].get(path.join('.'), { ...options, collate: false }));
		else
			targets = targets.map(target => this[target]);
		

		if (options.collate) {
			if (!targets.every(target => deepequal(target, targets[0])))
				throw new Error(`Expected all values to be equal while collating but they were not: ${targets}`);
			// We can just project to the first item, since we just checked that they're
			// all equal anyway
			targets = targets[0];
		}
		return targets;
	},
	/**
	 * @memberof ComplexDataObject
	 * @instance
	 * @description Returns a fresh copy of the `ComplexDataObject`. A fresh copy is a copy as it was when
	 * this `ComplexDataObject` was first created, i.e. with the effects of all prior multiplications
	 * reversed. (Note that this only pertains to `multiply` and `unmultiply` and does not include direct 
	 * writes to properties bypassing those methods.)
	 * 
	 * @return {ComplexDataObject} A copy of this `ComplexDataObject`, reset to the original state.
	 */
	freshCopy: function() {
		const dest = Array.isArray(this) ? [] : {};

		// Copy all enumerable properties by copying their descriptors
		for (let prop in this) {
			let desc = Object.getOwnPropertyDescriptor(this, prop);
			// If it is a value property, and it is an object, fresh-copy it
			if (typeof desc.value === 'object' && desc.value !== null)
				desc.value = desc.value.freshCopy();
			if ('value' in desc) {
				desc.value = this[originals][prop] ?? desc.value;
			}
			Object.defineProperty(dest, prop, desc);
		}
		return cdo(dest);
	},
	/**
	 * @deprecated
	 */
	clone: function() {
		return cloneProperties(this);
	},	
}
/*
 * The prototype for a `ComplexDataObject` over array data.
 */
const ComplexDataArray = {};
// Copy over all definitions from ComplexDataObject, then make all methods
// non-enumerable on both prototypes. (Otherwise they will show up in 
// for...in loops.)
Object.assign(ComplexDataArray, ComplexDataObject);
for (let method in ComplexDataObject) {
	Object.defineProperty(ComplexDataObject, method, { enumerable: false });
	Object.defineProperty(ComplexDataArray, method, { enumerable: false });
}
// Make ComplexDataArray inherit from Array
Object.setPrototypeOf(ComplexDataArray, Array.prototype);

/**
 * This function turns `data` into a `ComplexDataObject`. Any contained object properties
 * are also turned into `ComplexDataObject`s. 
 * 
 * If
 * 
 * 1. `data` is already a `ComplexDataObject`, or 
 * 2. `data` is a primitive, or
 * 3. `data` is something other than a plain old object (i.e. its prototype is `Object.prototype`) or array,
 *
 * it is returned at this point. Otherwise, its prototype is set to `ComplexDataObject` and returned.
 *
 * @param  {*} data The data to convert into a `ComplexDataObject`.
 * @return {ComplexDataObject|primitive}      `data`, converted into a `ComplexDataObject`. Note that this
 * function works in-place, i.e. `data === cdo(data)` is `true`.
 */
function cdo(data) {
	// Recursively turn object properties into CDOs
	for (let key in data) {
		// Need to work on property descriptors here to avoid invoking getters.
		// This is so that lazily-expanded references aren't forced to expand here.
		let property = Object.getOwnPropertyDescriptor(data, key);
		if (typeof property.value === 'object' && property.value !== null)
			data[key] = cdo(data[key]);
	}

	// Return the source if
	// - it is already a ComplexDataObject
	// - it is a primitive
	// - it is a "custom" class, i.e. it's not directly derived from Object. Arrays are excepted from this and
	//   will be augmented.
	if (isCDO(data) 
		|| typeof data !== 'object'
		|| (Object.getPrototypeOf(data) !== Object.prototype && !Array.isArray(data))) {
		// console.log(Object.getPrototypeOf(data) === ComplexDataObject || Object.getPrototypeOf(data) === ComplexDataArray)
		return data;
	}
	
	// Augment data with ComplexDataObject properties
	Object.setPrototypeOf(data, Array.isArray(data) ? ComplexDataArray : ComplexDataObject);	

	Object.defineProperty(data, originals, {
		value: {},
		enumerable: false,
		configurable: true,
		writable: true
	});
	return data;
}

/**
 * Checks whether `instance` is a `ComplexDataObject`.
 */
function isCDO(instance) {
	return typeof instance === 'object' 
		&& instance !== null 
		&& originals in instance 
		&& (ComplexDataObject.isPrototypeOf(instance) || ComplexDataArray.isPrototypeOf(instance));
}

export { cdo, isCDO }