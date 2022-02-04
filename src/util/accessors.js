import deepequal from 'deep-equal';

/**
 * @class AccessorMixin
 */
const AccessorMixin = (superclass) => {
	if (!superclass) superclass = class {};

	return class extends superclass {
		/**
		 * Gets the value that is stored under the provided key name, if any.
		 *
		 * The key supports dot notation to gain access to nested properties and
		 * array entries. To retrieve from an array, array indices need to be 
		 * expressed in dot notation as well.
		 *
		 * Furthermore, the key supports wildcards. Thus, an asterisk in any part
		 * of a key name will match an arbitrary number of characters, underscores,
		 * or digits. Note that when accessing nested properties after a wildcard,
		 * **all** objects that were retrieved for the wildcard are expected to have
		 * the nested properties. If this is not the case, an error will be thrown.
		 *
		 * If you are expecting the results of a wildcard match to all be the same,
		 * `get` can return a scalar value. This is done by setting the `collate` 
		 * property of `options` to `true`. This method will then check that all 
		 * values were indeed equal (more specifically, deeply equal), and then
		 * return a single value. If they are not in fact equal, an error will be
		 * thrown. By default, `collate` is set to `true`.
		 *
		 * Setting it to `false` will **always** return an array - even if the 
		 * key did not contain any wildcards at all. In that case, an array with a 
		 * single value is returned.
		 * 
		 * Examples, where `obj` is an `AccessorMixin`:
		 * - `obj.get('prop')`` is the same as `obj.prop`
		 * - `obj.get('nested.prop)` is the same as `obj.nested.prop`
		 * - `obj.get('arr.0')` is the same as `obj.arr[0]`
		 * - `obj.get('nested*.prop')` gets the value of the subproperty `prop` from
		 * all objects within `obj` whose name starts with `nested`. The values of all the
		 * individual `prop` properties must be the same, otherwise an error will be thrown.
		 * - `obj.get('nested*.prop`, { collate: false }) does the same thing, but does
		 * not expect the values to be equal. Instead, it returns an array containing
		 * the individual values.
		 * @param  {string} key The key to look up
		 * @param  {Object} [options={collate:true}] An optional object to set options for the
		 * retrieval.
		 * @param {boolean} options.collate=true	Whether to return the results of a wildcard
		 * match as a single value or as an array.
		 * @return {*}     The value for that key.
		 * @throws
		 * Throws an error 
		 * - if the requested property or any intermediate properties do
		 * not exist.
		 * - if `collate` is set to true in the `options` object, but the values of the
		 * retrieved property after a wildcard match are different.
		 * @memberof AccessorMixin
		 * @instance
		 */
		get(key, options = { collate: true }) {
			let self = this;
			// Split the key into its parts. These can be thought of as "path elements"
			// to traverse along the data object
			let path = key.split('.');
			let targets = [ self ];
			
			while(path.length > 0) { 
				let currKey = path.shift();
				if (currKey.includes('*')) { // @todo Implement ? wildcard which matches exactly one letter/_/digit
					// Turn the current key into a regular expression by replacing the asterisk with its regex equivalent
					currKey = new RegExp(`^${currKey.replace('*', '\\w*')}$`);					
					// For every target in targets, get its keys, filter them to those that match the regex, 
					// replace the keys by their values, and and project the result from an array of values
					// to just the values (this is what flatMap does).
					// Consider an object { matches: 1, matchestoo: 2}. If we used map instead of flatMap,
					// we would end up with [[1,2]] instead of the desired [1,2].
					targets = targets.flatMap(target => Object.keys(target) 
											.filter(key => currKey.test(key))
											.map(key => target[key]));
				} else {
					targets = targets.map(target => target[currKey]);
				}
				// All targets were required to have the accessed property
				if (targets.includes(undefined) || targets.length === 0)
					throw new Error(`Trying to read unknown property ${key} of ${self}`);

			}
			if (options.collate) {
				if (!targets.every(target => deepequal(target, targets[0])))
					throw new Error(`Expected all gotten values to be equal while collating but they were not: ${targets}`);
				// We can just project to the first item, since we just checked that they're
				// all equal anyway
				targets = targets[0];
			}
			return targets;
		}

		/**
		 * Sets the given key name to the passed value. 
		 *
		 * The key supports dot notation and wildcards. For details, about the notation, see {@link AccessorMixin#get}.
		 * 
		 * If any properties of the key are missing in the object, this method will throw an error. 
		 * Instead, if `options.create` is true, missing properties will be created and no error 
		 * will be thrown. `create` does not pertain to wildcard keys: missing properties on a wildcard
		 * element will always error.
		 *
		 * Examples, where `obj` is an `AccessorMixin`:
		 * - `obj.set('prop', 5)` will set `obj.prop` to the value 5, but error if `obj.prop` was
		 * undefined before.
		 * - `obj.set('prop', 5, { create: true })` is the same as the above, but will not error.
		 * - `obj.set('nested.prop', 0)` will set `obj.nested.prop` to 0, but error if either `obj.nested`
		 * or `obj.nested.prop` did not exist.
		 * - `obj.set('nested.prop', 0, { create: true }` is the same, but will not error. Instead,
		 * it will create missing properties. Afterwards, `obj` is guaranteed to have a property `nested`
		 * of type `object` that in turn has a property `prop` with value 0.
		 * - `obj.set('nested*', 'value')` will set the value of _any_ property whose name starts with
		 * 'nested' to `'value'`. If none exist, an error will be thrown. Note that even if `{ create: true }`
		 * were passed as a third parameter, it would still error, because property creation only happens
		 * for non-wildcard keys.
		 * - `obj.set('nested.*`, 'value' { create: true })` will set the value of _all_ properties of `obj.nested` to
		 * `'value'`. There is a subtle catch hidden in this with regard to the `create` option: If `obj.nested`
		 * does not exist, it will be created. However, since it is then an empty object, and the wildcard
		 * expression following it thus does not match anything, the call would still result in an error.
		 * 
		 * @param {string} key   The key to set. 
		 * @param {*} value The value to set it to.
		 * @param {Object} [options={create: false}] An optional options object.
		 * @parap {boolean} [options.create=false] Whether to create missing properties or throw an error instead. 
		 * The default is to error.
		 * @memberof AccessorMixin
		 * @instance
		 */
		set(key, value, options = { create: false }) {
			let self = this;

			let path = key.split('.');
			let targets = [ self ];
			// Traverse the path except for the last key. 
			// The last one needs to be kept so we can assign
			// a value to it 
			while (path.length > 0) {debugger
				let currKey = path.shift(); // Remove first element							
				// Turn the current key into a regular expression by replacing the asterisk with its regex equivalent
				let currKeyRegex = new RegExp(`^${currKey.replace('*', '\\w*')}$`);

				// For every target ...
				targets = targets.flatMap(target => {
					// ... get a list of its keys that match the currKey. This will be an array of
					// just one (or zero) key(s) if currKey does not contain wildcards.
					let matches = Object.keys(target).filter(key => currKeyRegex.test(key));
					// If that key doesn't exist in the object ...
					if (matches.length === 0) {
						// and the create option is set AND the currKey is not a wildcard expression
						if (options.create && !currKey.includes('*'))
							// Create the key and set it to an empty object if this is an intermediate
							// level, set it to the value if this is the last key
							// We can return that, because in Javascript assignments are expressions.
							return target[currKey] = path.length > 0 ? {} : value;
						else
							// If create option is not set, OR currKey has wildcards, error.
							// (We can't create a key if currKey is a wildcard, because it's unclear
							// what the key name would need to be.)
							throw new Error(`Trying to set unknown property ${key} of ${self} and options.create was false`);
					} else
						// If there were matches, either traverse if this is an intermediate level,
						// or set the new value if we are at the end
						return matches.map(match => path.length > 0 ? target[match] : target[match] = value);
				});
			}
		}
	}
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
AccessorMixin.createGetters = function(obj, definitions) {
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

export { AccessorMixin }