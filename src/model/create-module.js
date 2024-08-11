import Module from './modules/module.js';
import Artillery from './modules/artillery.js';
import Torpedoes from './modules/torpedoes.js';
import Hull from './modules/hull.js';
import FireControl from './modules/fireControl.js';

export default function createModule(kind, ship, data) {
	let Constructor = {
		'artillery': Artillery,
		'torpedoes': Torpedoes,
		'hull': Hull,
		'fireControl': FireControl
	}[kind] ?? Module;
	return new Constructor(ship, data);
}

