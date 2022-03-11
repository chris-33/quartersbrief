import { GameObject } from '../../src/model/gameobject.js';

describe('GameObject', function() {
	const TEST_DATA = { 
		prop1: 'string', 
		prop2: 0,
		nested: { prop3: 'prop3' },
		arr: [ 'prop4' ] 
	};

	it('should copy all properties from the source', function() {
		expect(new GameObject(TEST_DATA)).to
			.have.property('_data')
			.that.deep.equals(TEST_DATA);
	});
});