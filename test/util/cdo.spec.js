import { ComplexDataObject } from '../../src/util/cdo.js';
import sinon from 'sinon';
import clone from 'just-clone';

describe.only('ComplexDataObject', function() {
	const TEST_DATA = {
			prop1: 1,
			prop2: 0,
			nested: { prop3: 1, prop4: 0, prop5: 0 },
			nested2: { prop3: 1, prop4: 1 },
			arr: [ 1, 2, 3 ]
	};
	let cdo;

	beforeEach(function() {
		cdo = new ComplexDataObject(clone(TEST_DATA));
	});

	describe('constructor', function() {
		it('should turn nested object properties into ComplexDataObjects', function() {
			expect(cdo.get('nested'), 'objects should be turned into ComplexDataObjects').to.be.an.instanceof(ComplexDataObject);
			expect(cdo.get('arr'), 'arrays should be turned into ComplexDataObjects').to.be.an.instanceof(ComplexDataObject);
			const data = {
				preexisting: new ComplexDataObject({})				
			}
			cdo = new ComplexDataObject(data);
			expect(cdo.get('preexisting'), 'should clone pre-existing ComplexDataObjects properties').to.not.equal(data.preexisting); // shouldn't be the same instance
		});

		it('should create a new CDO that .equals() the source but is not strictly equal when called with a CDO', function() {
			let newCDO = new ComplexDataObject(cdo);
			expect(newCDO.equals(cdo)).to.be.true;
			expect(newCDO).to.not.equal(cdo);
		});

		it('should always work on a copy', function() {
			let data = {
				nested: {
					prop: 0
				},
				arr: [ { prop: 1 } ],
				preexisting: new ComplexDataObject({ prop: 2 })
			}
			cdo = new ComplexDataObject(data);
			expect(cdo.get('nested')).to.not.equal(data.nested);
			expect(cdo.get('arr.0')).to.not.equal(data.arr[0]);
			expect(cdo.get('preexisting')).to.not.equal(data.preexisting);
		});

		it('should mirror Array.prototype\'s functions if data is an array', function() {
			cdo = new ComplexDataObject([]);
			['concat', 'every', 'filter', 'find', 'findIndex', 'flat', 'flatMap', 'forEach', 'indexOf', 'join', 'map', 'reduce', 'some']
				.forEach(method => expect(cdo).to.respondTo(method));
		});

		it('should give the same result as the underlying array when using mirrored methods', function() {
			let fn = x => x;
			let arr = [1];
			cdo = new ComplexDataObject(arr);
			['concat', 'every', 'filter', 'find', 'findIndex', 'flat', 'flatMap', 'forEach', 'indexOf', 'join', 'map', 'reduce', 'some']
				.forEach(method => expect(cdo[method].call(cdo, fn), method).to.deep.equal(arr[method].call(arr, fn)));
		});
	});

	describe('ComplexDataObject.createGetters', function() {
		it('should create getters for all properties', function() {
			let obj = {};
			let definitions = {
				'Prop1': 'prop1',
				'Prop2': 'prop2',
				'Prop3': 'prop3'
			}
			ComplexDataObject.createGetters(obj, definitions);
			for (let property in definitions) expect(obj).to.respondTo('get' + property);
		});

		it('should read through for properties whose value is a string', function() {
			let obj = { get: function() {} };
			let definitions = {
				'Prop1': 'prop1'
			}
			let stub = sinon.stub(obj, 'get');
			try {
				ComplexDataObject.createGetters(obj, definitions);
				obj.getProp1();
				expect(stub).to.have.been.calledWith(definitions.Prop1);
			} finally {
				stub.restore();
			}
		});

		it('should invoke functions for properties whose value is a function', function() {
			let obj = {};
			let definitions = {
				'Prop1': sinon.stub()
			}
			ComplexDataObject.createGetters(obj, definitions);
			obj.getProp1();
			expect(definitions.Prop1).to.have.been.calledOn(obj);

			// No need to restore anything because we have not stubbed out any 
			// methods of an actual object
		});
	});

	describe('.keys', function() {
		it('should return all property keys', function() {
			expect(cdo.keys()).to.be.an('array').with.members(Object.keys(TEST_DATA));
		});
	});

	describe('.equals', function() {
		it('should return false if the other object is not a ComplexDataObject', function() {
			expect(cdo.equals({})).to.be.false;
		});

		it('should return false if the two CDOs don\'t have exactly the same keys', function() {
			let other = new ComplexDataObject({ otherprop: 0 });
			expect(cdo.equals(other)).to.be.false;
		});

		it('should return true if all "own" properties (i.e., primitives) are equal, false otherwise', function() {
			cdo = new ComplexDataObject({ prop1: 1, prop2: 'string', prop3: false });
			let other = new ComplexDataObject({ prop1: 1, prop2: 'string', prop3: false });
			expect(cdo.equals(other)).to.be.true;
			other = new ComplexDataObject({ prop1: 1, prop2: 'string', prop3: true });
			expect(cdo.equals(other)).to.be.false;
		});

		it('should return true if all nested values are equal, false otherwise', function() {
			const data = {
				prop1: {
					prop2: 0
				},
				prop3: [ 'a', 'b' ]
			}
			cdo = new ComplexDataObject(data);
			let other = new ComplexDataObject(data);
			expect(cdo.equals(other)).to.be.true;
			other = new ComplexDataObject({ ...data, prop1: { prop2: 1 }});
			expect(cdo.equals(other)).to.be.false;
		});

		it('should equal itself', function() {
			expect(cdo.equals(cdo)).to.be.true;
		});
	});

	describe('.get', function() {		
		it('should get primitive top-level properties', function() {						
			for (let key in TEST_DATA)
				if (typeof TEST_DATA[key] !== 'object')
					expect(cdo.get(key)).to.equal(TEST_DATA[key]);
		});

		it('should get object top-level properties, and they should be CDOs', function() {
			for (let key in TEST_DATA)
				if (typeof TEST_DATA[key] === 'object') {
					expect(cdo.get(key)).to.exist.and.be.an.instanceof(ComplexDataObject);
					expect(cdo.get(key).equals(new ComplexDataObject(TEST_DATA[key]))).to.be.true;
				}
		});

		it('should get nested properties with dot notation', function() {
			for (let key in TEST_DATA.nested)
				expect(cdo.get(`nested.${key}`)).to.equal(TEST_DATA.nested[key]);
		});

		it('should get array entries with dot notation', function() {
			for (let i = 0; i < TEST_DATA.arr.length; i++)
				expect(cdo.get(`arr.${i}`)).to.equal(TEST_DATA.arr[i]);
		});

		it('should return an array if collate option is set to false', function() {
			for (let key in TEST_DATA)
				expect(cdo.get(key, { collate: false })).to.be.an('array');
		});

		it('should return a single value when using wildcards and collate is true, an array of values when collate is false', function() {
			expect(cdo.get.bind(cdo, 'nested*.prop3', { collate: true })).to.not.throw();
			expect(cdo.get('nested*.prop3', { collate: true })).to.equal(TEST_DATA.nested.prop3);
			expect(cdo.get('nested*.prop3', { collate: false })).to.be.an('array').with.members([ TEST_DATA.nested.prop3, TEST_DATA.nested2.prop3 ]);
		});

		it('should return always return a shallow array even if using multiple wildcards', function() {
			expect(cdo.get('nested*.prop*', { collate: false })).to.be.an('array').with.members([
				TEST_DATA.nested.prop3, TEST_DATA.nested.prop4, TEST_DATA.nested.prop5,
				TEST_DATA.nested2.prop3, TEST_DATA.nested2.prop4
			]);
		})

		it('should throw when using wildcards and collate is true, but the values of the read properties are not all equal', function() {
			expect(cdo.get.bind('nested*.prop4')).to.throw();
		});
	});

	describe('.clone', function() {
		it('should .equal() the original CDO, but not be strictly equal', function() {
			let clonedCDO = cdo.clone();
			expect(cdo.equals(clonedCDO)).to.be.true;
			expect(cdo).to.not.equal(clonedCDO);
		});
	})
});