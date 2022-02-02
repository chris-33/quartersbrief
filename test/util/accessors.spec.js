import { AccessorMixin } from '../../src/util/accessors.js';

describe('AccessorMixin', function() {
	let Accessors;

	before(function() {
		Accessors = class extends AccessorMixin(null) {
			prop1 = 'string';
			prop2 = 0;
			nested = { prop3: 'prop3' };
			arr = [ 'prop4' ];
		};
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

		it('should get nested properties with dot notation', function() {
			expect(obj.get('nested.prop3')).to.equal(obj.nested.prop3);
		});

		it('should get array entries with dot notation', function() {
			expect(obj.get('arr.0')).to.equal(obj.arr[0]);
		});

		it('should return undefined if no such property exists', function() {
			expect(obj.get.bind(obj,'doesnotexist')).to.throw();
		});

		it('should return undefined if any intermediate levels are missing when using dot notation', function() {
			expect(obj.get.bind(obj,'doesnotexist.withdotnotation')).to.throw();
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

		it('should set new top-level properties', function() {
			obj.set('prop3', 'string');
			expect(obj).to
				.have.property('prop3')
				.that.equals('string');
		});

		it('should set nested properties with dot notation', function() {
			obj.set('nested.prop3', 'newvalue');
			expect(obj.nested.prop3).to.equal('newvalue');
		});

		it('should create missing intermediate level when setting nested properties', function(){
			obj.set('nested.morenested.prop', 'newvalue');
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