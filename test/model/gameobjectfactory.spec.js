var gameObjectFactory = require('$/src/model/gameobjectfactory');
var GameObject = require('$/src/model/gameobject');

describe('GameObjectFactory', function() {
	const TEST_DATA = {
		PAAA001_Test1: {
			id: 1,
			index: 'PAAA001',
			name: 'PAAA001_Test1'
		},
		PAAA002_Test2: {
			id: 2,
			index: 'PAAA002',
			name: 'PAAA002_Test2',
			reference: 'PAAA001_Test1'
		},
		PAAA003_Test3: {
			id: 3,
			index: 'PAAA003',
			name: 'PAAA003_Test3',
			nested: {
				reference: 'PAAA001_Test1'
			}
		},
		PAAA004_Test4: {
			id: 4,
			index: 'PAAA004',
			name: 'PAAA004_Test4',
			arr: ['PAAA001_Test1']
		},
		PAAA005_Test5: {
			id: 5,
			index: 'PAAA005',
			name: 'PAAA005_Test5',
			nested: {
				arr: ['PAAA002_Test2']
			}
		}
	};

	describe('.createGameObject', function() {
		beforeEach(function() {
			gameObjectFactory.setEverything(TEST_DATA);
		});

		it('should throw an error if no data has been set', function() {
			// Unset data from beforeEach
			gameObjectFactory.setEverything(undefined);
			expect(function() { gameObjectFactory.createGameObject('PAAA001'); }).to.throw(/No data/);

		});

		it('should throw an error if a malformed designator is passed', function() {
			// Need to wrap the call in a function, because a function is
			// expected as the parameter, not the function invocation's result
			
			// Check that a malformed designator causes an exception
			expect(function() { gameObjectFactory.createGameObject('malformed'); }).to.throw(/Invalid argument/);

			// Check that providing no designator at all causes an exception
			expect(function() { gameObjectFactory.createGameObject(); }).to.throw(/Invalid argument/);
		});

		it('should be able to retrieve a simple object by id', function() {			
			expect(gameObjectFactory.createGameObject(1)).to.deep.equal(TEST_DATA.PAAA001_Test1);
		});

		it('should be able to retrieve a simple object by reference code', function() {			
			expect(gameObjectFactory.createGameObject('PAAA001')).to.deep.equal(TEST_DATA.PAAA001_Test1);
		});

		it('should return a GameObject', function() {
			expect(gameObjectFactory.createGameObject('PAAA001')).to.be.an.instanceof(GameObject);
		})
	});

	describe('.expandReferences', function() {
		beforeEach(function() {
			gameObjectFactory.setEverything(TEST_DATA);
		});

		it('should expand references', function() {
			expect(gameObjectFactory.expandReferences(TEST_DATA.PAAA002_Test2)).to
				.have.property('reference')
				.that.deep.equals(TEST_DATA.PAAA001_Test1);
		});

		it('should expand references into game objects', function() {
			expect(gameObjectFactory.expandReferences(TEST_DATA.PAAA002_Test2)).to
				.have.property('reference')
				.that.is.an.instanceof(GameObject);
		});

		it('should not expand blacklisted references', function() {
			expect(gameObjectFactory.constructor.IGNORED_KEYS).to.include('name'); // Just to make sure
			expect(gameObjectFactory.expandReferences(TEST_DATA.PAAA001_Test1)).to
				.have.property('name')
				.that.deep.equals(TEST_DATA.PAAA001_Test1.name);
		});

		it('should expand references in nested objects', function() {
			expect(gameObjectFactory.expandReferences(TEST_DATA.PAAA003_Test3)).to
				.have.nested.property('nested.reference')
				.that.deep.equals(TEST_DATA.PAAA001_Test1);
		});

		it('should expand references in arrays', function() {
			expect(gameObjectFactory.expandReferences(TEST_DATA.PAAA004_Test4)).to
				.have.property('arr')
				.that.is.an('array')
				.that.deep.includes(TEST_DATA.PAAA001_Test1);
		});

		it('should fully expand complex objects', function() {
			expect(gameObjectFactory.expandReferences(TEST_DATA.PAAA005_Test5)).to
				.have.nested.property('nested.arr[0].reference')
				.that.deep.equals(TEST_DATA.PAAA001_Test1);
		});
	});
});