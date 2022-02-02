let arrayIntersect = (arr1, arr2) => arr1.filter(x => arr2.includes(x));

let	arrayDifference = (arr1, arr2) => arr1.filter(x => !arr2.includes(x));

export { arrayIntersect, arrayDifference }