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
			let currKey = path[0];			
			targets = targets.flatMap(target => target instanceof DataObject && target !== this ?
				// Hand off the operation to the target if the target is itself a DataObject 
				// But only if the target isn't this DataObject itself (happens when options.includeOwnProperties === true)
				target.get(DotNotation.join(path), { collate: false }) : 
				// Otherwise, select all properties of the target that match the current key
				DotNotation.resolve(currKey, target).map(key => target[key]));
			path.shift();
		}

		if (options.collate) {
			targets = collate(targets);
		}
		return targets;
	}

	multiply(key, factor, options) {
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
		// If target is a DataObject (and not this DataObject itself), hand off the multiplication to it. Otherwise,
		// multiply all matching properties.
		targets = targets.flatMap(target => target instanceof DataObject && target !== this ? 
				target.multiply(prop, factor) :
				DotNotation.resolve(prop, target).map(key => target[key] = target[key] * factor));

		if (options?.collate)
			targets = collate(targets);
		return targets;
	}
}