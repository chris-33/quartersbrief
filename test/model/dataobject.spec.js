import DataObject from '../../src/model/dataobject.js';
import clone from 'clone';

describe('DataObject', function() {
	const TEST_DATA = { 
		prop1: 'string', 
		prop2: 1,
		prop3: 1,
		nested: { prop1: 2, prop2: 3 },
		nested2: { prop1: 3 },
		arr: [ 3, 4 ],
		dataobject: {
			prop1: 1,
			typeinfo: {
				type: "Type1",
				species: null,
				nation: "Common"
			}
		},
		inner: {
			dataobject: {
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
	let obj;

	beforeEach(function() {
		obj = new DataObject(clone(TEST_DATA));
	});

	describe('.get', function() {
		it('should return its data when key is empty', function() {
			expect(obj.get('')).to.deep.equal(TEST_DATA);
		});

		it('should return a scalar if the key contains no wildcards and collate is not set specifically', function() {
			for (let key in TEST_DATA)
				expect(obj.get(key), key).to.deep.equal(TEST_DATA[key]);
		});

		it('should return an array if the key contains wildcards and collate is not set specifically', function() {
			expect(obj.get('prop*')).to.be.an('array').with.members([ TEST_DATA.prop1, TEST_DATA.prop2, TEST_DATA.prop3 ]);
		});

		it('should return a scalar if collate is true and an array if collate is false', function() {
			expect(obj.get('nested2*', { collate: true })).to.deep.equal(TEST_DATA.nested2);
			expect(obj.get('nested', { collate: false })).to.be.an('array').with.deep.members([ TEST_DATA.nested ]);
		});

		it('should throw if collate is true but not all results are equal', function() {
			expect(obj.get.bind('prop*', { collate: true })).to.throw();
		});

		it('should get from nested DataObjects', function() {
			expect(obj.get('dataobject.prop1')).to.equal(TEST_DATA.dataobject.prop1);
		})
	});

	describe('.multiply', function() {
		it('should multiply the correct own, nested, or array property', function() {
			const coeff = 2;
			obj.multiply('prop2', coeff);
			obj.multiply('nested.prop1', coeff);
			obj.multiply('arr.0', coeff);
			expect(obj._data.prop2, 'own property').to.equal(TEST_DATA.prop2 * coeff);			
			expect(obj._data.nested.prop1, 'nested property').to.equal(TEST_DATA.nested.prop1 * coeff);
			expect(obj._data.arr[0], 'array property').to.equal(TEST_DATA.arr[0] * coeff);
			// Make sure the coefficient doesn't just get registered across the board:
			expect(obj._data.prop3, 'other own property').to.equal(TEST_DATA.prop3);
			expect(obj._data.nested.prop2, 'other nested property').to.equal(TEST_DATA.nested.prop2);
			expect(obj._data.arr[1], 'other array property').to.equal(TEST_DATA.arr[1]);
		});

		it('should multiply all properties matching a wildcard key', function() {
			const coeff = 2;
			obj.multiply('nested*.prop1', coeff);
			obj.multiply('arr.*', coeff);
			expect(obj._data.nested.prop1).to.equal(TEST_DATA.nested.prop1 * coeff);
			expect(obj._data.nested2.prop1).to.equal(TEST_DATA.nested2.prop1 * coeff);
			expect(obj._data.arr).to.have.members(TEST_DATA.arr.map(i => i * coeff));
		});

		it('should multiply into nested DataObjects', function() {
			const coeff = 2;
			obj.multiply('dataobject.prop1', coeff);
			expect(obj._data.dataobject.prop1).to.equal(TEST_DATA.dataobject.prop1 * coeff);
		});
	});
});