/**
 * This is a thin wrapper around game object definitions as they can be read from
 * GameParams.data. 
 *
 * GameObject provides easy access to even nested and array properties using dot
 * notation. 
 * 
 */
class GameObject {
	/**
	 * Creates a new GameObject and copies all properties
	 * from data to it.
	 * @param  {Object} data The source to copy from
	 */
	constructor(data) {
		var self = this;

		// Copy over everything from data
		Object.assign(self, data);				
	}

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
	 * @return {*}     The value for that key, or undefined if no property of
	 * that key exists within the object.
	 */
	get(key) {
		var self = this;

		// Split the key into its parts. These can be thought of as "path elements"
		// to traverse along the data object
		var path = key.split('.');
		// Make an array that consists of the provided object as the first element
		// and the path elements after that
		return [self].concat(path)
			// Perform the lookup by reducing the array
			// This will perform a stepwise lookup of key
			// in the current obj.
			// See Array.prototype.reduce on MDN
			// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce
			.reduce((obj, key) => obj ? obj[key] : undefined);	
	}

	/**
	 * Returns this `GameObject`'s `typeinfo.type`, if such exists. It is shorthand for
	 * calling `get(typeinfo.type)`.
	 * @return {String} `typeinfo.type`, or `undefined` if not available.
	 */
	type() {
		return this.get('typeinfo.type');
	}
}

module.exports = GameObject;