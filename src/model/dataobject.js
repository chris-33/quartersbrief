import DotNotation from '../util/dotnotation.js';
import deepequal from 'deep-equal';

export function collate(data) {
	if (!data.every(item => deepequal(item, data[0])))
		throw new Error(`Expected all values to be equal while collating but they were not: [${data.join(', ')}]`);
	// We can just project to the first item, since we just checked that they're all equal anyway
	return data[0];
}

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

export default class DataObject {
	constructor(data) {
		// Must not be non-enumerable, otherwise cloning won't work correctly
		this._data = data;
	}

	get(key, options) {		
		options ??= {};
		options.collate ??= !DotNotation.isComplex(key);

		let targets = [ this._data ];
		if (options?.includeOwnProperties) targets.push(this);

		// If key is an empty string, return the DataObject itself.
		if (key === '') return options.collate ? this : [ this ];
		let path = DotNotation.elements(key);
		while (path.length > 0) {
			let currKey = path.shift();
			targets = targets.flatMap(target => target instanceof DataObject && target !== this ?
				// Hand off the operation to the target if the target is itself a DataObject 
				// But only if the target isn't this DataObject itself (happens when options.includeOwnProperties === true)
				target.get(currKey, { collate: false }) : 
				// Otherwise, select all properties of the target that match the current key
				DotNotation.resolve(currKey, target).map(key => target[key]));			
		}

		if (options.collate) {
			targets = collate(targets);
		}
		return targets;
	}

	apply(key, func, options) {
		let path = DotNotation.elements(key);
		let prop = path.pop();
		
		// Resolve to parent objects for a compound key. 
		// Otherwise, we are trying to multiply a property that sits directly in this DataObject,
		// so make the target this._data
		//
		// If the includeOwnProperties option is set, we pass this through to the get call, which will
		// resolve to all parent objects under _data OR under this. If key is not a compound key,
		// initialize targets to this and this._data
		let targets = DotNotation.isCompound(key) ? 
			this.get(DotNotation.join(path), { collate: false, includeOwnProperties: options?.includeOwnProperties }) :
			options?.includeOwnProperties ? [ this._data, this ] : [ this._data ]
		// If target is a DataObject (and not this DataObject itself), hand off the function application to it. Otherwise,
		// apply func to all matching properties.
		targets = targets.flatMap(target => target instanceof DataObject && target !== this ? 
				target.apply(prop, func) :
				DotNotation.resolve(prop, target).map(key => target[key] = func(target[key])));

		if (options?.collate)
			targets = collate(targets);
		return targets;		
	}

	multiply(key, factor, options) {
		return this.apply(key, x => factor * x, options);
	}

	add(key, summand, options) {
		return this.apply(key, x => summand + x, options);
	}

	set(key, value, options) {
		return this.apply(key, () => value, options);
	}
}