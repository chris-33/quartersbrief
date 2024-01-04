import DataObject, { expose } from '../../src/model/dataobject.js';

describe('DataObject', function() {
	describe('multiply', function() {
		it('should multiply the value in the data', function() {
			const data = { a: 1 };
			const obj = new DataObject(data);
			// Expose property
			Object.defineProperty(obj, 'a', {
				get: function() { return this._data.a },
				set: function(a) { this._data.a = a },
				enumerable: true
			})

			obj.multiply('a', 2);
			expect(data.a).to.equal(2);
		});
	});
	
	describe('nested DataObjects', function() {
		// A DataObject with an exposed "prop" property
		class Inner extends DataObject {
			get prop() { return this._data.prop; }
			set prop(val) { this._data.prop = val; }
		}
		// A DataObject with an exposed "inner" property
		class Outer extends DataObject {
			get inner() { return this._data.inner; }
			set inner(inner) { this._data.inner = inner; }
		}

		const val = 1;
		let obj;

		beforeEach(function() {
			obj = new Outer({ inner: new Inner({ prop: val }) });
		});

		it('should get from nested DataObjects', function() {
			expect(obj.get('inner.prop')).to.equal(val);
		});

		it('should apply into nested DataObjects', function() {
			const f = x => 2 ** x;
			obj.apply('inner.prop', f);

			expect(obj._data.inner.prop).to.equal(f(val));
		});

		it('should set in nested DataObjects', function() {
			const val = 2;
			obj.set('inner.prop', val);

			expect(obj._data.inner.prop).to.equal(val);
		});
	});
});

/* eslint-disable mocha/max-top-level-suites */
describe('expose', function() {
	let C;

	beforeEach(async function() {
		class X extends DataObject {}
		class Y extends X {}
		C = class extends Y {}
	});

	it('should throw an error when the class to expose on is not a subclass of DataObject', function() {		
		expect(expose.bind(null, class {})).to.throw();
		expect(expose.bind(null, {})).to.throw();
	});

	it('should expose the property on instances of the class', function() {
		expose(C, { 'prop': 'prop' });
		const obj = new C({});

		expect(obj).to.have.property('prop');
	});

	it('should read/write to the correct selector when accessing the property', function() {
		const selector = 'a.*';
		expose(C, { 'prop': selector });
		const data = {
			a: {
				b: 1,
				c: 2
			}
		}
		const obj = new C(data);

		expect(obj.prop).to.deep.equal(Object.values(data.a));
		obj.prop = 5;
		expect(data.a.b).to.equal(5);
		expect(data.a.c).to.equal(5);
	});
});
