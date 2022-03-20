import { cdo, isCDO } from '../../src/util/cdo.js';
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
	let obj;

	before(function() {
		Object.freeze(TEST_DATA);
	});

	beforeEach(function() {
		obj = cdo(clone(TEST_DATA));
	});

	const methods = [ 'multiply', 'clear', 'get' ];
	it(`should have methods ${methods.join(', ')}`, function() {
		for (let method of methods)
			expect(obj, method).to.respondTo(method);
	});
	
	it('should return the source if it is already a ComplexDataObject', function() {		
		obj.multiply('prop1', 2);
		let other = cdo(obj);
		expect(other).to.equal(obj);
	});

	it('should not invoke getters', function() {
		const spy = sinon.spy(function getter() { return 42; });

		let data = {};
		Object.defineProperty(data, 'prop', {
			get: spy,
			enumerable: true,
			configurable: true
		});
		obj = cdo(data);
		expect(spy).to.not.have.been.called;
	});

	it('should keep coefficients when cloning', function() {
		obj.multiply('prop1', 2);
		const other = clone(obj);
		expect(obj).to.deep.equal(other);
	});

	describe('.multiply', function() {
		it('should multiply the correct own, nested, or array property', function() {
			const coeff = 2;
			obj.multiply('prop1', coeff);
			obj.multiply('nested.prop1', coeff);
			obj.multiply('arr.0', coeff);
			expect(obj.prop1, 'own property').to.equal(TEST_DATA.prop1 * coeff);			
			expect(obj.nested.prop1, 'nested property').to.equal(TEST_DATA.nested.prop1 * coeff);
			expect(obj.arr[0], 'array property').to.equal(TEST_DATA.arr[0] * coeff);
			// Make sure the coefficient doesn't just get registered across the board:
			expect(obj.prop3, 'other own property').to.equal(TEST_DATA.prop3);
			expect(obj.nested.prop3, 'other nested property').to.equal(TEST_DATA.nested.prop3);
			expect(obj.arr[1], 'other array property').to.equal(TEST_DATA.arr[1]);
		});

		it('should multiply all properties matching a wildcard key', function() {
			const coeff = 2;
			obj.multiply('nested*.prop1', coeff);
			obj.multiply('arr.*', coeff);
			expect(obj.nested.prop1).to.equal(TEST_DATA.nested.prop1 * coeff);
			expect(obj.nested2.prop1).to.equal(TEST_DATA.nested2.prop1 * coeff);
			expect(obj.arr).to.have.members(TEST_DATA.arr.map(i => i * coeff));
		});
	});

	describe('.unmultiply', function() {
		it('should divide the correct own, nested, or array property', function() {
			const coeff = 2;
			const targets = [ 'prop1', 'nested.prop1', 'arr.0' ];
			targets.forEach(tgt => obj.multiply(tgt, coeff));
			targets.forEach(tgt => obj.unmultiply(tgt, coeff));
			expect(obj.prop1, 'own property').to.equal(TEST_DATA.prop1);			
			expect(obj.nested.prop1, 'nested property').to.equal(TEST_DATA.nested.prop1);
			expect(obj.arr[0], 'array property').to.equal(TEST_DATA.arr[0]);
		});

		it('should divide all properties matching a wildcard key', function() {
			const coeff = 2;
			const targets = [ 'nested*.prop1', 'arr.*' ];
			targets.forEach(tgt => obj.multiply(tgt, coeff));
			targets.forEach(tgt => obj.unmultiply(tgt, coeff));

			expect(obj.nested.prop1).to.equal(TEST_DATA.nested.prop1);
			expect(obj.nested2.prop1).to.equal(TEST_DATA.nested2.prop1);
			expect(obj.arr).to.have.members(TEST_DATA.arr);
		});
	});

	describe('.clear', function() {
		it('should reset own properties to their original values', function() {
			const coeff = 2;
			[ 'prop1', 'prop2', 'prop3' ].forEach(prop => obj.multiply(prop, coeff));
			obj.clear();
			expect(obj).to.deep.equal(TEST_DATA);
		});

		it('should reset nested and array properties to their original values', function() {
			const coeff = 2;
			[ 'nested.*', 'arr.*' ].forEach(prop => obj.multiply(prop, coeff));
			obj.clear();
			expect(obj).to.deep.equal(TEST_DATA);
		});

		it('should not invoke getters', function() {
			const data = clone(TEST_DATA);
			const stub = sinon.stub().returns(TEST_DATA.nested);
			Object.defineProperty(data, 'nested', {
				get: stub,
				enumerable: true,
				configurable: true
			});
			obj = cdo(data);
			obj.clear();
			expect(stub).to.not.have.been.called;
		});
	});

	describe('.get', function() {		
		it('should get top-level properties', function() {						
			for (let key in TEST_DATA)
				expect(obj.get(key), key).to.deep.equal(TEST_DATA[key]);
		});

		it('should get nested and array properties with dot notation', function() {
			for (let key in TEST_DATA.nested)
				expect(obj.get(`nested.${key}`),`nested.${key}`).to.equal(TEST_DATA.nested[key]);
			for (let i = 0; i < TEST_DATA.arr.length; i++)
				expect(obj.get(`arr.${i}`), `arr.${i}`).to.equal(TEST_DATA.arr[i]);
		});

		it('should get deeply nested properties', function() {
			// The point of this test is to make sure that deeply nested properties
			// result in the right array depth - i.e., that collating does not remove
			// too many levels, and that not collating does not add too many
			let data = { ...clone(TEST_DATA), deeply: { nested: { object: { prop: 1 }}}};
			obj = cdo(data);
			expect(obj.get('deeply.nested.object.prop'), 'scalar with default collate').to.equal(1);
			expect(obj.get('deeply*.nested*.object*.*'), 'shallow array with default collate').to.deep.equal([1])
		});

		it('should get array properties as arrays', function() {
			// The point of this test is to make sure that collation does not unintentionally
			// flatten array properties - i.e., that .get() doesn't try to collate array
			// properties
			let data = clone(TEST_DATA);
			data.prop1 = [1,2,3];
			data.nested.prop1 = [1,2,3];
			data.nested.prop2 = [[1],[2],[3]];
			obj = cdo(data);
			expect(obj.get('prop1'), 'top-level array property').to
				.be.an('array')
				.with.members(data.prop1);
			expect(obj.get('nested.prop1'), 'nested array property').to
				.be.an('array')
				.with.deep.members(data.nested.prop1);
			expect(obj.get('nested.prop2'), 'nested array of arrays property').to
				.be.an('array')
				.with.deep.members(data.nested.prop2)
		});

		it('should always return an array if collate option is set to false', function() {
			for (let key in TEST_DATA)
				expect(obj.get(key, { collate: false })).to.be.an('array');
		});

		it('should default to collating when the key contains no wildcards, but not otherwise', function() {
			expect(obj.get('prop1')).to.not.be.an('array');
			expect(obj.get('prop1*')).to.be.an('array');
		});

		it('should throw when collating and not all values are equal', function() {
			expect(obj.get.bind('nested.*', { collate: true })).to.throw();
		});

		it('should return a single value when using wildcards and collate is true, an array of values when collate is false', function() {
			expect(obj.get.bind(obj, 'nested*.prop1', { collate: true })).to.not.throw();
			expect(obj.get('nested*.prop1', { collate: true })).to.equal(TEST_DATA.nested.prop3);
			expect(obj.get('nested*.prop1', { collate: false })).to
				.be.an('array')
				.with.members([ TEST_DATA.nested.prop1, TEST_DATA.nested2.prop1 ]);
		});

		it('should return always return a shallow array even if using multiple wildcards', function() {
			expect(obj.get('nested*.prop*', { collate: false })).to.be.an('array').with.members([
				TEST_DATA.nested.prop1, TEST_DATA.nested.prop2, TEST_DATA.nested.prop3,
				TEST_DATA.nested2.prop1, TEST_DATA.nested2.prop2
			]);
		})

		it('should throw when using wildcards and collate is true, but the values of the read properties are not all equal', function() {
			expect(obj.get.bind('nested*.prop4')).to.throw();
		});
	});

	describe('.freshCopy', function() {
		it('should return a ComplexDataObject', function() {
			const other = obj.freshCopy();
			expect(isCDO(other)).to.be.true;
		});

		it('should discard prior multiplications', function() {
			obj.multiply('prop3', 2);
			const other = obj.freshCopy();
			expect(other).to.not.deep.equal(obj);
			obj.clear();
			expect(other).to.deep.equal(obj);
		});

		it('should not strict-equal the source, and neither should any contained object properties', function() {
			const other = obj.freshCopy();
			expect(other).to.not.equal(obj);
			Object.keys(other)
				.filter(key => typeof obj[key] === 'object')
				.forEach(key => expect(other[key]).to.not.equal(obj.key));
		});

		it('should deep-equal the source', function() {
			const other = obj.freshCopy();
			expect(other).to.deep.equal(obj);
		});

		it('should copy accessor properties without invoking their getters', function() {
			const spy = sinon.spy();
			const data = {};
			Object.defineProperty(data, 'prop', {
				get: spy,
				enumerable: true
			});
			obj = cdo(data);
			const other = obj.freshCopy();
			expect(spy).to.not.have.been.called;
			expect(other).to.have.property('prop');
		});

	});

	describe('.clone', function() {
		it('should deep equal the source', function() {
			const other = obj.clone();
			expect(other).to.deep.equal(obj);
		});

		it('should not strict-equal the source, and neither should any contained object properties', function() {
			const other = obj.clone();
			expect(other).to.not.equal(obj);
			Object.keys(other)
				.filter(key => typeof obj[key] === 'object')
				.forEach(key => expect(other[key]).to.not.equal(obj.key));
		});

		it('should clone accessor properties without invoking their getters', function() {
			const spy = sinon.spy();
			const data = {};
			Object.defineProperty(data, 'prop', {
				get: spy,
				enumerable: true
			});
			obj = cdo(data);
			const other = obj.clone();
			expect(spy).to.not.have.been.called;
			expect(other).to.have.property('prop');
		});
	});

	describe('isCDO', function() {
		it('should return true if the target is a ComplexDataObject, false otherwise', function() {
			expect(isCDO(obj)).to.be.true;
			expect(isCDO({})).to.be.false;
		});
	});
});