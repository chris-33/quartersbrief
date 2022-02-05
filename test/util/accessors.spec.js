import { AccessorMixin } from '../../src/util/accessors.js';
import sinon from 'sinon';


describe('AccessorMixin', function() {
	let Accessors;

	before(function() {
		Accessors = class extends AccessorMixin(null) {
			prop1 = 1;
			prop2 = 0;
			nested = { prop3: 1, prop4: 0, prop5: 0 };
			nested2 = { prop3: 1, prop4: 1 };
			arr = [ 1 ];			
		};
	});

	describe('AccessorMixin.createGetters', function() {

		it('should create getters for all properties', function() {
			let obj = {};
			let definitions = {
				'Prop1': 'prop1',
				'Prop2': 'prop2',
				'Prop3': 'prop3'
			}
			AccessorMixin.createGetters(obj, definitions);
			for (let property in definitions) expect(obj).to.respondTo('get' + property);
		});

		it('should read through for properties whose value is a string', function() {
			let obj = { get: function() {} };
			let definitions = {
				'Prop1': 'prop1'
			}
			let stub = sinon.stub(obj, 'get');
			try {
				AccessorMixin.createGetters(obj, definitions);
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
			AccessorMixin.createGetters(obj, definitions);
			obj.getProp1();
			expect(definitions.Prop1).to.have.been.calledOn(obj);

			// No need to restore anything because we have not stubbed out any 
			// methods of an actual object
		});
	});
	
	describe('.apply', function() {		
		let obj;
		const fn = (x) => x === undefined ? - 1 : 2**x; // Will always be positive for any defined x, is injective

		beforeEach(function() {
			obj = new Accessors();
		});

		it('should apply the function to top-level properties', function() {						
			let spy = sinon.spy(fn);
			let val = obj.prop1;
			expect(obj.apply('prop1', spy)).to.equal(fn(val));
			expect(spy).to.have.been.calledWith(val);
		});

		it('should apply the function to nested properties with dot notation', function() {
			let spy = sinon.spy(fn);
			let val = obj.nested.prop3;
			expect(obj.apply('nested.prop3', spy)).to.equal(fn(val));
			expect(obj.nested.prop3).to.equal(fn(val));
			expect(spy).to.have.been.calledWith(val);
		});

		it('should apply the function to array entries with dot notation', function() {
			let spy = sinon.spy(fn);
			let val = obj.arr[0];
			expect(obj.apply('arr.0', spy)).to.equal(fn(val));
			expect(obj).to.have.property('arr').with.members([fn(val)]);
			expect(spy).to.have.been.calledWith(val);
		});

		it('should throw if no such property exists and create is set to true, create it otherwise', function() {			
			expect(obj.apply.bind(obj,'doesnotexist', fn, { create: false })).to.throw();
			let spy = sinon.spy(fn);
			expect(obj.apply('doesnotexist', spy, { create: true })).to.equal(fn(undefined));
			expect(obj).to.have.property('doesnotexist').that.equals(fn(undefined));
			expect(spy).to.have.been.calledWith(undefined);
		});

		it('should throw if any intermediate levels are missing when using dot notation and create is false, create them otherwise', function() {
			expect(obj.get.bind(obj,'doesnotexist.withdotnotation')).to.throw();
			let spy = sinon.spy(fn);
			expect(obj.apply('doesnotexist.withdotnotation', spy, { create: true })).to.equal(fn(undefined));
			expect(obj).to.have.property('doesnotexist').that.has.property('withdotnotation').that.equals(fn(undefined));
			expect(spy).to.have.been.calledWith(undefined);
		});

		it('should return an array if collate option is set to false', function() {
			expect(obj.apply('prop1', fn, { collate: false })).to.be.an('array');
		});

		it('should apply the function to all matching properties when using wildcards', function() {
			let spy = sinon.spy(fn);
			let val = [obj.nested.prop3, obj.nested2.prop3];
			expect(obj.apply('nested*.prop3', spy, { collate: false })).to
				.be.an('array').with.members(val.map(fn));
			expect(obj.nested.prop3).to.equal(fn(val[0]));
			expect(obj.nested2.prop3).to.equal(fn(val[1]));
			expect(spy).to.have.been.calledTwice;
		});

		it('should always throw if no properties match when using wildcards, regardless of create option', function() {
			expect(obj.apply.bind(obj, 'doesnotexist*', fn, { create: true })).to.throw();
			expect(obj.apply.bind(obj, 'doesnotexist*', fn, { create: false })).to.throw();
		});

		it('should throw if collate is true and results of applying the function are not equal', function() {
			expect(obj.apply.bind(obj, 'nested*.prop4', fn, { collate: true })).to.throw();
		});

		it('should apply the function to all matching properties even with multiple wildcards', function() {
			const complex = new Accessors();
			complex.nested = {
					prop: { innernested1: { prop: 1 }, innernested2: { prop: 2 }}
			};
			complex.nested2 = {
					prop: { innernested1: { prop: 3 }, innernested2: { prop: 4 }}
			}
			let val = [complex.nested.prop.innernested1.prop, complex.nested.prop.innernested2.prop, complex.nested2.prop.innernested1.prop, complex.nested2.prop.innernested2.prop];
			let spy = sinon.spy(fn);
			expect(complex.apply('nested*.prop.innernested*.prop', spy, { collate: false })).to
				.be.an('array')
				.with.members([fn(val[0]), fn(val[1]), fn(val[2]), fn(val[3])]);
			expect(spy).to.have.callCount(val.length);
		});

	});
});