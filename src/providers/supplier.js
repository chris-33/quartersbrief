/**
 * `Supplier` is, at its heart, a cache that maps designators (most commonly strings, although other types are possible) to data, 
 * augmented with a mechanism to fill missing data on cache misses. This is done by running the recovery function provided at
 * instantiation, which is expected to return the requested data. Recovery may be asynchronous.
 */
export default class Supplier {
	cache = new Map();

	/**
	 * Constructs a new `Supplier` using the provided functions for recovery and validation.  
	 */
	constructor(options) {
		if (typeof options === 'function') {
			options = { recover: options }
		}

		this.recover = options?.recover ?? this.recover;
		this.validate = options?.validate ?? this.validate;
	}

	/**
	 * Procure the object for the requested `designator`. If possible, the requested object will be procured from cache. If it is
	 * not in cache, the recovery function will be run to procure the object, and the result will be put into cache for future calls.
	 * @param  {*} designator The designator of the requested object
	 * @return {*}            The object for the designator
	 */
	async get(designator) {
		// Try getting the requested item from the cache
		let result = this.cache.get(designator);
		
		// Check that the cached item is (still) valid
		if (result && typeof this.validate === 'function' && !this.validate(result)) {
			result = null;			
		}

		// If no (valid) result could be taken from the cache, do recovery and cache the result
		if (!result) {
			result = this.recover(designator);
			this.cache.set(designator, result);
		}

		return await result;
	}
}