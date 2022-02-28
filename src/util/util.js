let arrayIntersect = (arr1, arr2) => arr1.filter(x => arr2.includes(x));

let	arrayDifference = (arr1, arr2) => arr1.filter(x => !arr2.includes(x));

let arrayEqual = (arr1, arr2) => arr1.every(x => arr2.includes(x)) && arr2.every(x => arr1.includes(x));

export { arrayIntersect, arrayDifference, arrayEqual }