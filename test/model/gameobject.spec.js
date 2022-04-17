import { GameObject } from '../../src/model/gameobject.js';
import clone from 'clone';
import sinon from 'sinon';

describe.only('GameObject', function() {
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

	describe('.get', function() {
		it('should return a scalar if the key contains no wildcards and collate is not set specifically', function() {
			for (let key in TEST_DATA)
				expect(gameObject.get(key), key).to.deep.equal(TEST_DATA[key]);
		});

		it('should return an array if the key contains wildcards and collate is not set specifically', function() {
			expect(gameObject.get('prop*')).to.be.an('array').with.members([ TEST_DATA.prop1, TEST_DATA.prop2, TEST_DATA.prop3 ]);
		});

		it('should return a scalar if collate is true and an array if collate is false', function() {
			expect(gameObject.get('nested2*', { collate: true })).to.deep.equal(TEST_DATA.nested2);
			expect(gameObject.get('nested', { collate: false })).to.be.an('array').with.deep.members([ TEST_DATA.nested ]);
		});

		it('should throw if collate is true but not all results are equal', function() {
			expect(gameObject.get.bind('prop*', { collate: true })).to.throw();
		});
	});

	describe('.multiply', function() {
		it('should multiply the correct own, nested, or array property', function() {
			const coeff = 2;
			gameObject.multiply('prop2', coeff);
			gameObject.multiply('nested.prop1', coeff);
			gameObject.multiply('arr.0', coeff);
			expect(gameObject._data.prop2, 'own property').to.equal(TEST_DATA.prop2 * coeff);			
			expect(gameObject._data.nested.prop1, 'nested property').to.equal(TEST_DATA.nested.prop1 * coeff);
			expect(gameObject._data.arr[0], 'array property').to.equal(TEST_DATA.arr[0] * coeff);
			// Make sure the coefficient doesn't just get registered across the board:
			expect(gameObject._data.prop3, 'other own property').to.equal(TEST_DATA.prop3);
			expect(gameObject._data.nested.prop2, 'other nested property').to.equal(TEST_DATA.nested.prop2);
			expect(gameObject._data.arr[1], 'other array property').to.equal(TEST_DATA.arr[1]);
		});

		it('should multiply all properties matching a wildcard key', function() {
			const coeff = 2;
			gameObject.multiply('nested*.prop1', coeff);
			gameObject.multiply('arr.*', coeff);
			expect(gameObject._data.nested.prop1).to.equal(TEST_DATA.nested.prop1 * coeff);
			expect(gameObject._data.nested2.prop1).to.equal(TEST_DATA.nested2.prop1 * coeff);
			expect(gameObject._data.arr).to.have.members(TEST_DATA.arr.map(i => i * coeff));
		});

		it('should multiply into nested GameObjects', function() {
			const coeff = 2;
			gameObject.multiply('go.prop1', coeff);
			expect(gameObject._data.go.prop1).to.equal(TEST_DATA.go.prop1 * coeff);
		});
	});
});