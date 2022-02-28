import { GameObject } from '../../src/model/gameobject.js';

describe('GameObject', function() {
	const TEST_DATA = { 
		prop1: 'string', 
		prop2: 0,
		nested: { prop3: 'prop3' },
		arr: [ 'prop4' ] 
	};

	describe('.clone', function() {
		it('should return a GameObject that .equals() the original', function() {
			let gameObject = new GameObject(TEST_DATA);
			expect(gameObject.clone()).to.be.an.instanceof(GameObject);
			expect(gameObject.clone().equals(gameObject)).to.be.true;
		});
	});
});