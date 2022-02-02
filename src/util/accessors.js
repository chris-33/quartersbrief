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
		 * Examples, where `go` is a `GameObject`:
		 * - `go.get('prop')`` is the same as `go.prop`
		 * - `go.get('nested.prop)` is the same as `go.nested.prop`
		 * - `go.get('arr.0')` is the same as `go.arr[0]`
		 * - `go.get('nested*.prop')` gets the value of the subproperty `prop` from
		 * all objects within `go` whose name starts with `nested`. The values of all the
		 * individual `prop` properties must be the same, otherwise an error will be thrown.
		 * - `go.get('nested*.prop`, { collate: false }) does the same thing, but does
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
			let targets = [self];
			
			while(path.length > 0) {
				let currKey = path.shift();
				if (currKey.includes('*')) {
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
					if (targets.some(target => target.length === 0))
						throw new Error(`Trying to read unknown property ${key} of ${self}`);
				} else {
					targets = targets.map(target => target[currKey]);
					// All targets were required to have the accessed property
					if (targets.includes(undefined))
						throw new Error(`Trying to read unknown property ${key} of ${self}`);
				}

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
		 * The key supports dot notation. If any intermediate levels are missing,
		 * they will be created. For example, for a class `C` that is an `AccessorMixin`
		 * `new C({a: {}).set('a.b.c', 5)` 
		 * will result in `{a: b: 5}}`.
		 * @param {string} key   The key to set.
		 * @param {*} value The value to set it to.
		 * @memberof AccessorMixin
		 * @instance
		 */
		set(key, value) {
			let self = this;

			let path = key.split('.');
			let target = self;
			// Traverse the path except for the last key. 
			// The last one needs to be kept so we can assign
			// a value to it 
			while (path.length > 1) {
				let currKey = path.shift(); // Remove first element			
				if (!target[currKey]) 
					target[currKey] = {}; // Create intermediate levels if they are missing
				target = target[currKey];
			}
			target[path.shift()] = value;
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