import DataObject, { includeOwnPropertiesByDefault } from './dataobject.js';

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
}
Object.defineProperty(Weapon.prototype, 'mounts', { enumerable: true });
includeOwnPropertiesByDefault(Weapon.prototype);

class Artillery extends Weapon {
	/** Main artillery caliber in mm. */
	getCaliber() { return 1000 * this.get('mounts.*.barrelDiameter', { collate: true }); }
}

class Torpedoes extends Weapon {
	getReload() { return this.get('shotDelay'); }
}

export default function createModule(kind, ship, data) {
	let Constructor = {
		'artillery': Artillery,
		'torpedoes': Torpedoes,
	}[kind] ?? Module;
	return new Constructor(ship, data);
}

export { Module, Weapon, Artillery }

