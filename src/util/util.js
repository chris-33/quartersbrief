let arrayIntersect = (arr1, arr2) => arr1.filter(x => arr2.includes(x));

let	arrayDifference = (arr1, arr2) => arr1.filter(x => !arr2.includes(x));

function cloneProperties(src) {
	let dest;
	if (Array.isArray(src))
		dest = [];
	else 
		dest = Object.create(Object.getPrototypeOf(src));

	let descs = Object.getOwnPropertyDescriptors(src);
	for (let prop in descs) {
		let desc = descs[prop];
		if (typeof desc.value === 'object' && desc.value !== null)
			desc.value = cloneProperties(desc.value);
	}
	Object.defineProperties(dest, descs);
	return dest;
}

export { arrayIntersect, arrayDifference, cloneProperties }