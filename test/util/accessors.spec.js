import { AccessorMixin } from '../../src/util/accessors.js';
import sinon from 'sinon';


describe('AccessorMixin', function() {
	let Accessors;

	before(function() {
		Accessors = class extends AccessorMixin(null) {
			prop1 = 'string';
			prop2 = 0;
			nested = { prop3: 'prop3', prop4: 0, prop5: 0 };
			nested2 = { prop3: 'prop3', prop4: 1 };
			arr = [ 'prop4' ];			
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
	
	describe('.get', function() {		
		let obj;

		beforeEach(function() {
			obj = new Accessors();
		});

		it('should get top-level properties', function() {						
			for (let key of Object.keys(obj))
				// Need to use deep equality here because there are complex properties
				// that will have been cloned, therefore the object references are different
				expect(obj.get(key)).to.deep.equal(obj[key]);
		});

		it('should throw if no such property exists', function() {
			expect(obj.get.bind(obj,'doesnotexist')).to.throw();
		});

		it('should get nested properties with dot notation', function() {
			expect(obj.get('nested.prop3')).to.equal(obj.nested.prop3);
		});

		it('should get array entries with dot notation', function() {
			expect(obj.get('arr.0')).to.equal(obj.arr[0]);
		});

		it('should throw if any intermediate levels are missing when using dot notation', function() {
			expect(obj.get.bind(obj,'doesnotexist.withdotnotation')).to.throw();
		});

		it('should return an array if collate option is set to false', function() {
			expect(obj.get('prop1', { collate: false })).to.be.an('array');
		});

		it('should get values for all matching properties when using wildcards', function() {
			expect(obj.get('nested*.prop3', { collate: false })).to
				.be.an('array').with.members(['prop3','prop3']);
		});

		it('should throw if no values match when using wildcards', function() {
			expect(obj.get.bind(obj,'doesnotexist*')).to.throw();
		});

		it('should throw if collating and properties are not equal when using wildcards', function() {
			expect(obj.get.bind(obj, 'nested*.prop4')).to.throw();
		});

		it('should throw if not all matching properties have the requested subproperties when using wildcards', function() {
			expect(obj.get.bind(obj, 'nested*.prop5')).to.throw();
		});

		it('should handle multiple wildcards correctly', function() {
			const complex = new Accessors();
			complex.nested = {
					prop: { innernested1: { prop: 'prop' }, innernested2: { prop: 'prop' }}
			};
			complex.nested2 = {
					prop: { innernested1: { prop: 'prop' }, innernested2: { prop: 'prop' }}
			}
			
			expect(complex.get('nested*.prop.innernested*.prop', { collate: false })).to
				.be.an('array').with.members(['prop', 'prop', 'prop', 'prop']);
		});

	});

	describe('.set', function() {
		let obj;

		beforeEach(function() {
			obj = new Accessors(obj);
		});

		it('should set existing top-level properties', function() {
			obj.set('prop1', 'newvalue');
			expect(obj.prop1).to.equal('newvalue');
		});

		it('should set new top-level properties when the create option is true and throw an error if it is not', function() {
			expect(obj.set.bind(obj, 'prop3', 'string')).to.throw();
			obj.set('prop3', 'string', { create: true });
			expect(obj).to
				.have.property('prop3')
				.that.equals('string');
		});

		it('should set nested properties with dot notation', function() {
			obj.set('nested.prop3', 'newvalue');
			expect(obj.nested.prop3).to.equal('newvalue');
		});

		it('should create missing intermediate level when setting nested properties and the create option is true, throw if it is not', function(){
			expect(obj.set.bind(obj, 'nested.morenested.prop', 'newValue')).to.throw();
			obj.set('nested.morenested.prop', 'newvalue', { create: true });
			expect(obj.nested).to
				.have.property('morenested');
			expect(obj.nested.morenested).to
				.have.property('prop')
				.that.equals('newvalue');
		});

		it('should set array array items with dot notation', function(){
			obj.set('arr.0', 'newvalue');
			expect(obj.arr).to.have.members(['newvalue']);
		});
	});	
});