import deepequal from 'deep-equal';

const coefficients = Symbol('coefficients');

function ComplexDataObject(data) {	
	// Recursively turn object properties into CDOs
	for (let key in data) 
		if (typeof data[key] === 'object' && data[key] !== null)
			data[key] = ComplexDataObject(data[key]);

	// Return the source if
	// - it is already a CDO
	// - it is a primitive
	// - it is a "custom" class, i.e. it's not directly derived from Object. Arrays are excepted from this and
	//   will be augmented.
	if (ComplexDataObject.isCDO(data) 
		|| typeof data !== 'object'
		|| (Object.getPrototypeOf(data) !== Object.prototype && !Array.isArray(data))) {

		return data;
	}
	
	// Augment data with CDO properties
	Object.defineProperties(data, {
		[coefficients]: {
			value: {},
			writable: true,
			enumerable: false
		},
		multiply: { 
			value: function(key, factor) {
				let path = key.split('.');
				let currKeyRegex = new RegExp(`^${path.shift().replace('*', '\\w*')}$`);
				let targets = Object.keys(this).filter(key => currKeyRegex.test(key));
				if (path.length === 0)
					targets.forEach(target => {
						this[coefficients][target] ??= [];
						this[coefficients][target].push(factor);
					});
				else 
					targets.forEach(target => this[target].multiply(path.join('.'), factor));				
			},
			enumerable: false
		},
		clear: {
			value: function() {
				this[coefficients] = {};
				for (let val of Object.values(this))
					if (ComplexDataObject.isCDO(val)) val.clear();
			},
			enumerable: false
		},
		get: {
			value: function(key, options) {
				options ??= {};
				options.collate ??= !key.includes('*');

				let path = key.split('.');
				let currKeyRegex = new RegExp(`^${path.shift().replace('*', '\\w*')}$`);
				let targets = Object.keys(this)
					.filter(key => currKeyRegex.test(key));

				// If we are getting a leaf property, do so for every target. Otherwise, call get
				// recursively with the rest of the path. In this case, we must use flatMap and 
				// turn off collation. This is to make sure that collating does not flatten
				// array properties, and that not collating does not produce deeply nested arrays
				// (i.e. arrays of arrays of arrays of ...)
				if (path.length > 0)
					targets = targets.flatMap(target => this[target].get(path.join('.'), { ...options, collate: false }));
				else
					targets = targets.map(target => this[target]);

				if (options.collate) {
					if (!targets.every(target => deepequal(target, targets[0])))
						throw new Error(`Expected all values to be equal while collating but they were not: ${targets}`);
					// We can just project to the first item, since we just checked that they're
					// all equal anyway
					targets = targets[0];
				}
				return targets;
			}
		}
	});

	// Finally, return a proxy to the data that intercepts all read operations and applies
	// registered coefficients to number properties
	return new Proxy(data, {
		get: function(tgt, prop) {
			if (typeof tgt[prop] === 'number')
				return tgt[coefficients][prop]?.reduce((prev, coeff) => prev * coeff, tgt[prop]) ?? tgt[prop];
			else
				return tgt[prop];
		}
	});
}

/**
 * Checks whether `instance` is a ComplexDataObject.
 */
ComplexDataObject.isCDO = function(instance) {
	return typeof instance === 'object' && instance !== null && coefficients in instance;
}

export { ComplexDataObject }