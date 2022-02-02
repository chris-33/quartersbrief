import { autocreate } from '$/src/util/autocreate-getters.js';
import sinon from 'sinon';

describe('getter-autocreate', function() {

	it('should create getters for all properties', function() {
		let obj = {};
		let definitions = {
			'Prop1': 'prop1',
			'Prop2': 'prop2',
			'Prop3': 'prop3'
		}
		autocreate(obj, definitions);
		for (let property in definitions) expect(obj).to.respondTo('get' + property);
	});

	it('should read through for properties whose value is a string', function() {
		let obj = { get: function() {} };
		let definitions = {
			'Prop1': 'prop1'
		}
		let stub = sinon.stub(obj, 'get');
		try {
			autocreate(obj, definitions);
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
		autocreate(obj, definitions);
		obj.getProp1();
		expect(definitions.Prop1).to.have.been.calledOn(obj);

		// No need to restore anything because we have not stubbed out any 
		// methods of an actual object
	});
});