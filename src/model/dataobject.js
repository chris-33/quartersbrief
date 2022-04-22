import DotNotation from '../util/dotnotation.js';
import deepequal from 'deep-equal';

export default class DataObject {
	constructor(data) {
		this._data = data;		
	}

	get(key, options) {		
		options ??= {};
		options.collate ??= !DotNotation.isComplex(key);

		let targets = [ this._data ];
		// If key is an empty string, return the DataObject itself.
		if (key === '') return options.collate ? this : [ this ];
		let path = DotNotation.elements(key);
		while (path.length > 0) {
			let currKey = path.shift();
			targets = targets.flatMap(target => target instanceof DataObject ?
				// Hand off the operation to the target if the target is itself a DataObject 
				target.get(DotNotation.join(path), { collate: false }) : 
				// Otherwise, select all properties of the target that match the current key
				DotNotation.resolve(currKey, target).map(key => target[key]));
		}

		if (options.collate) {
			if (!targets.every(target => deepequal(target, targets[0])))
				throw new Error(`Expected all values to be equal while collating but they were not: [${targets.join(', ')}]`);
			// We can just project to the first item, since we just checked that they're all equal anyway
			targets = targets[0];
		}
		return targets;
	}

	multiply(key, factor) {
		let path = DotNotation.elements(key);
		let prop = path.pop();
		
		// Resolve to parent objects for a compound key. 
		// Otherwise, we are trying to multiply a property that sits directly in this DataObject,
		// so make the target this._data
		let targets = DotNotation.isCompound(key) ? 
			this.get(DotNotation.join(path), { collate: false }) :
			[ this._data ]
		// If target is a DataObject, hand off the multiplication to it. Otherwise,
		// multiply all matching properties.
		return targets.map(target => target instanceof DataObject ? 
				target.multiply(prop, factor) :
				DotNotation.resolve(prop, target).map(key => target[key] = target[key] * factor));
	}	
}