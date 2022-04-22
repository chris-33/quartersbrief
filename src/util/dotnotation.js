export default class DotNotation {
	constructor() {
		throw new Error(`DotNotation is not meant to be instantiated.`);
	}

	/**
	 * Checks if `key` is a *complex key* - one that contains at least one wildcard. It does not
	 * matter whether `key` also a compound key.
	 * @param  {String}  key The key to check.
	 * @return {Boolean}     `true` if `key` contains at least one wildcard, `false` otherwise.
	 */
	static isComplex(key) {
		return key.includes('*');
	}

	/**
	 * Checks if `key` is a *compound key* - one that is made up of several elements
	 * separated by `.`. 
	 * @param  {String}  key The key to check.
	 * @return {Boolean}     `true` if `key` contains at least one `.`, `false` otherwise.
	 */
	static isCompound(key) {
		return key.includes('.');
	}

	/**
	 * Splits `key` into its elements. For example, `a.b.c` becomes `[ 'a', 'b', 'c' ]`.
	 * @param  {String} key The key to split.
	 * @return {String[]}     An array of the individual elements for `key`.
	 */
	static elements(key) {
		return key.split('.');
	}

	/**
	 * Constructs a key from `elements`, adjoining them with `.`.
	 * @param  {String[]} elements The key elements to join. May include wildcards.
	 * @return {String}      The `elements`, joined by `.`.
	 */
	static join(path) {
		return path.join('.');
	}

	/**
	 * Resolves a single step by returning the names of all properties that match `prop` in `base`. 
	 * Supports wildcards, but not dot notation.
	 * @param  {String} prop The properties to select. May contain wildcards.
	 * @param  {Object} base The object against which to resolve.
	 * @return {Array} An array of all property names in `base` that matched `prop`. Even if `prop` was a simple
	 * key, the result is still an array.
	 */
	static resolve(key, base) {
		if (DotNotation.isCompound(key)) 
			throw new TypeError(`Cannot resolve compound key ${key}`);

		let regex = new RegExp(`^${key.replace('*', '\\w*')}$`);
		return Object.keys(base).filter(regex.test.bind(regex));
	}
}