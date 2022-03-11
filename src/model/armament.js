import { ComplexDataObject } from '../util/cdo.js';
import clone from 'clone';

/**
 * @class
 */
const Armament = class extends ComplexDataObject {
	static #GETTER_DEFINITIONS = {

	}

	constructor(data) {
		super();
		let self = this;

		Object.assign(self, clone(data));
	}

	/** 
	 * An array of the individual mounts (e.g. gun turrets, launchers, etc.) for this armament.
	 */
	get qb_mounts() {
		return Object.values(this).filter(obj => 
				typeof obj === 'object' && 'typeinfo' in obj && obj.typeinfo.type === 'Gun');
	}	
}

const Artillery = class extends Armament {
	static #GETTER_DEFINITIONS = {
		BaseRange: 'maxDist',
		Caliber: 'qb_mounts.barrelDiameter'
	}

	constructor(data) {
		super(data);

		ComplexDataObject.createGetters(this, Artillery.#GETTER_DEFINITIONS);		
	}
}

const Torpedoes = class extends Armament {

}

export { Armament, Artillery, Torpedoes }