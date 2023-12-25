import { compile, get, set, perform } from 'object-selectors';

/**
 * Modifies `obj` so that the `includeOwnProperties` option is enabled by default in `get` and `multiply`. 
 *
 * Use it on a prototype to enable the option by default for all objects of a class.
 * @param  {Object} obj The object for which to enable `includeOwnProperties` by default.
 */
export function includeOwnPropertiesByDefault(obj) {
	let get = obj.get;
	let multiply = obj.multiply;

	obj.get = function(key, options) {
		options ??= {};
		options.includeOwnProperties ??= true;
		return get.call(this, key, options);
	}

	obj.multiply = function(key, factor, options) {
		options ??= {};
		options.includeOwnProperties ??= true;
		return multiply.call(this, key, factor, options);
	}
}

/**
 * Exposes all properties in `properties` on the class's instances. `properties` is a hash from property names to selectors. 
 * Reading an exposed property will `get` that selector, writing to it will `set` the value on that selector.
 * @param  {DataObject} cls        The class to expose the property on. Must be a subclass of `DataObject`.
 * @param  {Object} properties A hash from property names to selectors.
 * @return {DataObject}            The class that was passed in.
 * @throws A `TypeError` if `cls` is not a constructor (a function), or not derived from `DataObject`.
 */
export function expose(cls, properties) {
	if (typeof cls !== 'function')
		throw new TypeError(`Can only expose properties on classes, but got ${typeof cls}`);	
	if (!(cls.prototype instanceof DataObject))
		throw new TypeError(`Can only expose properties on classes derived from DataObject, but got ${cls.name || '<anonymous class>'}`);

	for (const property in properties) {
		const selector = compile(`_data.${properties[property]}`);

		Object.defineProperty(cls.prototype, property, {
			get: function() { return selector.get(this); },
			set: function(val) { selector.set(this, val); },
			enumerable: true
		});
	}
	return cls;
}

export default class DataObject {
	constructor(data) {
		Object.defineProperty(this, '_data', {
			value: data,
			writable: true,
			configurable: true,
			enumerable: false
		});
	}

	get(key, options) {
		return get(key, this, options);
	}

	apply(key, func, options) {
		return perform(key, func, this, options);
	}

	multiply(key, factor, options) {
		return this.apply(key, x => factor * x, options);
	}

	add(key, summand, options) {
		return this.apply(key, x => summand + x, options);
	}

	set(key, value, options) {
		return set(key, this, value, options);
	}
}