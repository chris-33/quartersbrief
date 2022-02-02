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

export { AccessorMixin }