import { ComplexDataObject } from '../../src/util/cdo.js';
import sinon from 'sinon';
import clone from 'clone';

describe('ComplexDataObject', function() {
	const TEST_DATA = {
			prop1: 1,
			prop2: 0,
			prop3: 1,
			nested: { prop1: 1, prop2: 0, prop3: 1 },
			nested2: { prop1: 1, prop2: 1 },
			arr: [ 1, 1 ]
	};
	let cdo;

	before(function() {
		Object.freeze(TEST_DATA);
	});

	beforeEach(function() {
		cdo = ComplexDataObject(clone(TEST_DATA));
	});

	it('should have methods multiply and get', function() {
		expect(cdo).to.respondTo('multiply');
		expect(cdo).to.respondTo('get');
	});

	it('should return the source if it is already a ComplexDataObject', function() {		
		cdo.multiply('prop1', 2);
		let other = ComplexDataObject(cdo);
		expect(other).to.equal(cdo);
	});

	describe('.multiply', function() {
		it('should apply the coefficient on the correct own, nested, or array property', function() {
			const coeff = 2;
			cdo.multiply('prop1', coeff);
			cdo.multiply('nested.prop1', coeff);
			cdo.multiply('arr.0', coeff);
			expect(cdo.prop1, 'own property').to.equal(TEST_DATA.prop1 * coeff);			
			expect(cdo.nested.prop1, 'nested property').to.equal(TEST_DATA.nested.prop1 * coeff);
			expect(cdo.arr[0], 'array property').to.equal(TEST_DATA.arr[0] * coeff);
			// Make sure the coefficient doesn't just get registered across the board:
			expect(cdo.prop3, 'other own property').to.equal(TEST_DATA.prop3);
			expect(cdo.nested.prop3, 'other nested property').to.equal(TEST_DATA.nested.prop3);
			expect(cdo.arr[1], 'other array property').to.equal(TEST_DATA.arr[1]);
		});

		it('should apply the coefficient on all properties matching a wildcard key', function() {
			const coeff = 2;
			cdo.multiply('nested*.prop1', coeff);
			cdo.multiply('arr.*', coeff);
			expect(cdo.nested.prop1).to.equal(TEST_DATA.nested.prop1 * coeff);
			expect(cdo.nested2.prop1).to.equal(TEST_DATA.nested2.prop1 * coeff);
			expect(cdo.arr).to.have.members(TEST_DATA.arr.map(i => i * coeff));
		});
	});

	describe('.clear', function() {
		it('should remove all own coefficients', function() {
			const coeff = 2;
			[ 'prop1', 'prop2', 'prop3' ].forEach(prop => cdo.multiply(prop, coeff));
			cdo.clear();
			expect(cdo).to.deep.equal(TEST_DATA);
		});

		it('should remove all nested and array coefficients', function() {
			const coeff = 2;
			[ 'nested.*', 'arr.*' ].forEach(prop => cdo.multiply(prop, coeff));
			cdo.clear();
			expect(cdo).to.deep.equal(TEST_DATA);
		});
	});

	describe('.get', function() {		
		it('should get top-level properties', function() {						
			for (let key in TEST_DATA)
				expect(cdo.get(key), key).to.deep.equal(TEST_DATA[key]);
		});

		it('should get nested and array properties with dot notation', function() {
			for (let key in TEST_DATA.nested)
				expect(cdo.get(`nested.${key}`),`nested.${key}`).to.equal(TEST_DATA.nested[key]);
			for (let i = 0; i < TEST_DATA.arr.length; i++)
				expect(cdo.get(`arr.${i}`), `arr.${i}`).to.equal(TEST_DATA.arr[i]);
		});

		it('should get deeply nested properties', function() {
			// The point of this test is to make sure that deeply nested properties
			// result in the right array depth - i.e., that collating does not remove
			// too many levels, and that not collating does not add too many
			let data = { ...clone(TEST_DATA), deeply: { nested: { object: { prop: 1 }}}};
			cdo = ComplexDataObject(data);
			expect(cdo.get('deeply.nested.object.prop'), 'scalar with default collate').to.equal(1);
			expect(cdo.get('deeply*.nested*.object*.*'), 'shallow array with default collate').to.deep.equal([1])
		});

		it('should get array properties as arrays', function() {
			// The point of this test is to make sure that collation does not unintentionally
			// flatten array properties - i.e., that .get() doesn't try to collate array
			// properties
			let data = clone(TEST_DATA);
			data.prop1 = [1,2,3];
			data.nested.prop1 = [1,2,3];
			data.nested.prop2 = [[1],[2],[3]];
			cdo = ComplexDataObject(data);
			expect(cdo.get('prop1'), 'top-level array property').to
				.be.an('array')
				.with.members(data.prop1);
			expect(cdo.get('nested.prop1'), 'nested array property').to
				.be.an('array')
				.with.deep.members(data.nested.prop1);
			expect(cdo.get('nested.prop2'), 'nested array of arrays property').to
				.be.an('array')
				.with.deep.members(data.nested.prop2)
		});

		it('should always return an array if collate option is set to false', function() {
			for (let key in TEST_DATA)
				expect(cdo.get(key, { collate: false })).to.be.an('array');
		});

		it('should default to collating when the key contains no wildcards, but not otherwise', function() {
			expect(cdo.get('prop1')).to.not.be.an('array');
			expect(cdo.get('prop1*')).to.be.an('array');
		});

		it('should throw when collating and not all values are equal', function() {
			expect(cdo.get.bind('nested.*', { collate: true })).to.throw();
		});

		it('should return a single value when using wildcards and collate is true, an array of values when collate is false', function() {
			expect(cdo.get.bind(cdo, 'nested*.prop1', { collate: true })).to.not.throw();
			expect(cdo.get('nested*.prop1', { collate: true })).to.equal(TEST_DATA.nested.prop3);
			expect(cdo.get('nested*.prop1', { collate: false })).to
				.be.an('array')
				.with.members([ TEST_DATA.nested.prop1, TEST_DATA.nested2.prop1 ]);
		});

		it('should return always return a shallow array even if using multiple wildcards', function() {
			expect(cdo.get('nested*.prop*', { collate: false })).to.be.an('array').with.members([
				TEST_DATA.nested.prop1, TEST_DATA.nested.prop2, TEST_DATA.nested.prop3,
				TEST_DATA.nested2.prop1, TEST_DATA.nested2.prop2
			]);
		})

		it('should throw when using wildcards and collate is true, but the values of the read properties are not all equal', function() {
			expect(cdo.get.bind('nested*.prop4')).to.throw();
		});
	});
});