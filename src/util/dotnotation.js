/**
 * Checks if `key` is a *complex key* - one that contains at least one wildcard. It does not
 * matter whether `key` also a compound key.
 * @param  {String}  key The key to check.
 * @return {Boolean}     `true` if `key` contains at least one wildcard, `false` otherwise.
 */
export function isComplex(key) {
	return key.includes('*');
}

/**
 * Checks if `key` is a *compound key* - one that is made up of several elements
 * separated by `.`. 
 * @param  {String}  key The key to check.
 * @return {Boolean}     `true` if `key` contains at least one `.`, `false` otherwise.
 */
export function isCompound(key) {
	return key.includes('.');
}

/**
 * Splits `key` into its elements. For example, `a.b.c` becomes `[ 'a', 'b', 'c' ]`.
 * @param  {String} key The key to split.
 * @return {String[]}     An array of the individual elements for `key`.
 */
export function elements(key) {
	return key.split('.');
}

/**
 * Constructs a key from `elements`, adjoining them with `.`.
 * @param  {String[]} elements The key elements to join. May include wildcards.
 * @return {String}      The `elements`, joined by `.`.
 */
export function join(path) {
	return path.join('.');
}

/**
 * Resolves a single step by returning the names of all properties that match `prop` in `base`. 
 * Supports wildcards, but not dot notation.
 * @param  {String} prop The properties to select. May contain wildcards.
 * @param  {Object} base The object against which to resolve.
 * @return {String[]} An array of all property names in `base` that matched `prop`. Even if `prop` was a simple
 * key, the result is still an array.
 */
export function resolve(key, base) {
	if (isCompound(key)) 
		throw new TypeError(`Cannot resolve compound key ${key}`);

	let regex = new RegExp(`^${key.replace('*', '\\w*')}$`);
	let result = [];
	for (let key in base)
		if (regex.test(key)) result.push(key);
	return result;
}