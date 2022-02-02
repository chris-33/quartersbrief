const AccessorMixin = (superclass) => {
	if (!superclass) superclass = class {};

	return class extends superclass {
		/**
		 * Gets the value that is stored under the provided key name, if any.
		 *
		 * The key supports dot notation to gain access to nested properties and
		 * array entries. Array indices need to be expressed in dot notation as well.
		 * Examples, where `go` is a `GameObject`:
		 * - `go.get('prop')`` is the same as `go.prop`
		 * - `go.get('nested.prop)` is the same as `go.nested.prop`
		 * - `go.get('arr.0')` is the same as `go.arr[0]`
		 * @param  {string} key The key to look up
		 * @return {*}     The value for that key.
		 * @throws
		 * Throws an error if the property does not exist, or
		 * any intermediate levels are missing when using dot notation.
		 */
		get(key) {
			let self = this;
			// Split the key into its parts. These can be thought of as "path elements"
			// to traverse along the data object
			let path = key.split('.');
			let target = self;
			while(path.length > 0) {
				let currKey = path.shift();
				target = target[currKey];
				if (target === undefined) 
					throw new Error(`Trying to read unknown property ${key} of ${self}`);
			}
			return target;
		}

		/**
		 * Sets the given key name to the passed value. 
		 *
		 * The key supports dot notation. If any intermediate levels are missing,
		 * they will be created. For example, `new GameObject({a: {}).set('a.b.c', 5)` 
		 * will result in `{a: b: 5}}`.
		 * @param {string} key   The key to set.
		 * @param {*} value The value to set it to.
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