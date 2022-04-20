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
		// If key is an empty string, that means we are just selected the root object.
		// So make path the empty array.
		let path = key !== '' ?
			DotNotation.elements(key) :
			[];
		while (path.length > 0) {
			let currKey = path.shift();
			targets = targets.flatMap(target => target instanceof DataObject ?
				// Hand off the operation to the target if the target is itself a DataObject 
				target.get(path.join('.'), { collate: false }) : 
				// Otherwise, select all properties of the target that match the current key
				DotNotation.resolve(currKey, target).map(key => target[key]));
		}

		if (options.collate) {
			if (!targets.every(target => deepequal(target, targets[0])))
				throw new Error(`Expected all values to be equal while collating but they were not: ${targets}`);
			// We can just project to the first item, since we just checked that they're all equal anyway
			targets = targets[0];
		}
		return targets;
	}

	multiply(key, factor) {
		let path = DotNotation.elements(key);
		let prop = path.pop();
		let targets = this.get(path.join('.'), { collate: false });
		targets = targets.map(target => target instanceof DataObject ? 
			target.multiply(prop, factor) :
			DotNotation.resolve(prop, target).map(key => target[key] = target[key] * factor));
		return targets;
	}	
}