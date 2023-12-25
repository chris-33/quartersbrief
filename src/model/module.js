import DataObject from './dataobject.js';

export default class Module extends DataObject {
	constructor(ship, data) {
		super(data);
		this._ship = ship;
	}
}



// export default function createModule(kind, ship, data) {
// 	let Constructor = {
// 		'artillery': Artillery,
// 		'torpedoes': Torpedoes,
// 	}[kind] ?? Module;
// 	return new Constructor(ship, data);
// }

