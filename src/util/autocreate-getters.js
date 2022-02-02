/**
 * This module exports a single function, that defines getter functions on the object for the definitions
 * defined in `definitions`. `definitions` must be an object where all values all either strings or functions.
 *
 * For each key-value pair (property, definition) in `definitions`, the object will get a method named `get` + `property`.
 * If the `definition` is a string, the method will return the value of the property with that name by calling
 * `obj.get(definition)`. If `definition` is a function, the method will be that function with "this" bound to `obj`.
 * @param  {Object} obj        The object for which to create getters. It must support reading of definitions using
 * `get(name)`. Most commonly this will be a `GameObject`.
 * @param  {Object} definitions An object of key-value pairs for the properties to create getters for. 
 */
function autocreate(obj, definitions) {
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

export { autocreate }