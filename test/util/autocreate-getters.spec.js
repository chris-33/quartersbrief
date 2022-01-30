var autocreate = require('$/src/util/autocreate-getters');
var sinon = require('sinon');

describe('getter-autocreate', function() {

	it('should create getters for all properties', function() {
		var obj = {};
		var definitions = {
			'Prop1': 'prop1',
			'Prop2': 'prop2',
			'Prop3': 'prop3'
		}
		autocreate(obj, definitions);
		for (property in definitions) expect(obj).to.respondTo('get' + property);
	});

	it('should read through for properties whose value is a string', function() {
		var obj = { get: function() {} };
		var definitions = {
			'Prop1': 'prop1'
		}
		var stub = sinon.stub(obj, 'get');
		try {
			autocreate(obj, definitions);
			obj.getProp1();
			expect(stub).to.have.been.calledWith(definitions.Prop1);
		} finally {
			stub.restore();
		}
	});

	it('should invoke functions for properties whose value is a function', function() {
		var obj = {};
		var definitions = {
			'Prop1': sinon.stub()
		}
		autocreate(obj, definitions);
		obj.getProp1();
		expect(definitions.Prop1).to.have.been.calledOn(obj);

		// No need to restore anything because we have not stubbed out any 
		// methods of an actual object
	});
});