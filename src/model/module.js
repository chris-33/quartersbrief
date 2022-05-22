import DataObject from './dataobject.js';
import DotNotation from '../util/dotnotation.js';

class Module extends DataObject {
	constructor(ship, data) {
		super(data);
		this._ship = ship;
	}
}

/**
 * This is the base class for any weapon module. Weapons are any module on a ship that fire projectiles
 * from one or more weapon mounts.
 * For example, torpedo launchers, main and secondary artillery, and depth charge launchers are all weapons.
 */
class Weapon extends Module {
	get mounts() {
		return Object.values(this._data).filter(obj => 
				typeof obj === 'object' && 'typeinfo' in obj && obj.typeinfo.type === 'Gun');
	}

	get(key, options) {
		let path = DotNotation.elements(key);
		if (path[0] === 'mounts') {
			// Create a temporary DataObject from this.mounts and hand off the operation to it
			return new DataObject(this.mounts).get(DotNotation.join(path.slice(1)), options);
		} else
			return super.get(key, options);
	}

	multiply(key, factor) {
		let path = DotNotation.elements(key);
		if (path[0] === 'mounts') {
			// Create a temporary DataObject from this.mounts and hand off the operation to it
			return new DataObject(this.mounts).multiply(DotNotation.join(path.slice(1)), factor);
		} else
			return super.multiply(key, factor);		
	}
}

class Artillery extends Weapon {
	/** Main artillery caliber in mm. */
	getCaliber() { return 1000 * this.get('mounts.*.barrelDiameter', { collate: true }) }
}


export default function createModule(kind, ship, data) {
	let Constructor = {
		'artillery': Artillery
	}[kind] ?? Module;
	return new Constructor(ship, data);
}

export { Module, Weapon, Artillery }

