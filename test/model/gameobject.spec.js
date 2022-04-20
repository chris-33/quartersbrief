import { GameObject } from '../../src/model/gameobject.js';
import clone from 'clone';

describe('GameObject', function() {
	const TEST_DATA = { 
		prop1: 'string', 
		prop2: 1,
		prop3: 1,
		nested: { prop1: 2, prop2: 3 },
		nested2: { prop1: 3 },
		arr: [ 3, 4 ],
		go: {
			prop1: 1,
			typeinfo: {
				type: "Type1",
				species: null,
				nation: "Common"
			}
		},
		inner: {
			go: {
				prop: 'gameobject',
				typeinfo: {
					type: "Type1",
					species: null,
					nation: "Common"
				}
			}
		},
		typeinfo: {
			type: "Type1",
			species: null,
			nation: "Common"
		}
	};
	let gameObject;

	beforeEach(function() {
		gameObject = new GameObject(clone(TEST_DATA));
	});
});