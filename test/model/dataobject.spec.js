import DataObject, { includeOwnPropertiesByDefault } from '../../src/model/dataobject.js';
import clone from 'clone';
import sinon from 'sinon';

describe('DataObject', function() {
	const TEST_DATA = { 
		prop1: 'string', 
		prop2: 1,
		prop3: 1,
		nested: { prop1: 2, prop2: 3 },
		nested2: { prop1: 3 },
		arr: [ 5, 6 ],
		dataobject: {
			prop1: 7
		},
		inner: {
			dataobject: {
				prop: 'dataobject'
			}
		}
	};
	let obj;

	beforeEach(function() {
		let data = clone(TEST_DATA);
		data.dataobject = new DataObject(data.dataobject);
		data.inner.dataobject = new DataObject(data.inner.dataobject);
		obj = new DataObject(data);
	});

	describe('.get', function() {
		it('should return itself when key is empty', function() {
			expect(obj.get('')).to.equal(obj);
		});

		it('should return a scalar if the key contains no wildcards and collate is not set specifically', function() {
			Object.keys(TEST_DATA)
				// Filter out any key that is or contains DataObjects, because they will fail the deep-equal test
				.filter(key => !['dataobject', 'inner'].includes(key))
				.forEach(key => expect(obj.get(key), key).to.deep.equal(TEST_DATA[key]));
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
		});

		it('should include own properties when includeOwnProperties is set to true', function() {
			let key = 'ownProperty';
			obj[key] = 'ownproperty';
			// Make sure own properties are picked up when includeOwnProperties is true
			expect(obj.get(key, { includeOwnProperties: true })).to.equal(obj[key]);
			// Make sure they are NOT picked up otherwise
			expect(obj.get(key, { includeOwnProperties: false })).to.not.exist;

			// Make sure that own properties don't shadow data properties
			key = 'prop1';
			obj[key] = 'ownprop1';
			expect(obj.get('prop1', { 
				includeOwnProperties: true,
				collate: false  // explicitly set collate to false, because otherwise get will throw since obj[key] !== obj._data[key]
			})).to.be.an('array').with.members([ TEST_DATA[key], obj[key] ]);
		});
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
			expect(obj._data.nested.prop1).to.equal(TEST_DATA.nested.prop1 * coeff);
			expect(obj._data.nested2.prop1).to.equal(TEST_DATA.nested2.prop1 * coeff);

			obj = new DataObject(clone(TEST_DATA));
			obj.multiply('arr.*', coeff);
			expect(obj._data.arr).to.have.members(TEST_DATA.arr.map(i => i * coeff));

			obj = new DataObject(clone(TEST_DATA));
			obj.multiply('nested.*', coeff);
			expect(obj._data.nested.prop1).to.equal(TEST_DATA.nested.prop1 * coeff);
			expect(obj._data.nested.prop2).to.equal(TEST_DATA.nested.prop2 * coeff);
		});

		it('should multiply into nested DataObjects', function() {
			const coeff = 2;
			obj.multiply('dataobject.prop1', coeff);
			expect(obj._data.dataobject._data.prop1).to.equal(TEST_DATA.dataobject.prop1 * coeff);
		});

		it('should return a scalar when collate is true', function() {
			delete obj._data.prop1;
			const coeff = 2;
			expect(obj.multiply('prop*', coeff, { collate: true })).to.equal(TEST_DATA.prop2 * coeff);
		});

		it('should not collate by default even with a complex key', function() {			
			expect(obj.multiply('nested.*', 2)).to.be.an('array');
		});

		it('should throw if collate is true but not all multiplication results are equal', function() {
			expect(obj.multiply.bind(obj, 'nested.prop*', 2, { collate: true })).to.throw();
		});

		it('should multiply into own properties when includeOwnProperties is set to true', function() {
			obj.nested = clone(TEST_DATA.nested);
			const coeff = 2;
			const expected = Object.values(obj.nested).concat(Object.values(TEST_DATA.nested)).map(x => x * coeff);			
			expect(obj.multiply('nested.*', coeff, { includeOwnProperties: true })).to.be.an('array').with.members(expected);
			Object.keys(TEST_DATA.nested).forEach(key => {
				expect(obj.nested[key]).to.equal(TEST_DATA.nested[key] * coeff);
				expect(obj._data.nested[key]).to.equal(TEST_DATA.nested[key] * coeff);
			});			
		});
	});
});

/* eslint-disable mocha/max-top-level-suites */
describe('includeOwnPropertiesByDefault', function() {
	let obj;
	beforeEach(function() {
		obj = new DataObject({});
	});

	// Because the expected behavior of overridden multiply and get is so similar, their respective test case
	// are auto-generated here
	// 
	// eslint-disable-next-line mocha/no-setup-in-describe
	['multiply', 'get'].forEach(methodName => {
		it(`should set the includeOwnProperties option by default unless specifically disabled for .${methodName}()`, function() {			
			// Spy on the original method
			let method = sinon.spy(obj, methodName);
			includeOwnPropertiesByDefault(obj);

			const key = 'consumable1.value';
			const coeff = 2;
			// Execute the test cases specified below:
			[ 
				null, // No options specified
				{}, // Options specified but not includeOwnProperties
				{ includeOwnProperties: true }, // includeOwnProperties specifically set to true
				{ includeOwnProperties: false } // includeOwnProperties specifically set to false
			].forEach(options => {
				// Construct arguments array and apply the method to it
				const args = [ key ];
				if (methodName === 'multiply') args.push(coeff);
				args.push(options);
				obj[methodName].apply(obj, args);
					
				// Expected value of includeOwnProperties: always true, unless specifically set to false
				const expected = options?.includeOwnProperties ?? true;
					
				// Expected arguments to super[method] call
				const expectedArgs = [ key ];
				if (methodName === 'multiply') expectedArgs.push(coeff);
				expectedArgs.push(sinon.match({ includeOwnProperties: expected }));

				expect(method, `options = ${options}`).to.have.been.calledWith(...expectedArgs);
			});
		});
	});
});