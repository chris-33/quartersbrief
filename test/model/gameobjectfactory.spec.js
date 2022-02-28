import { GameObjectFactory } from '../../src/model/gameobjectfactory.js';
import { GameObject } from '../../src/model/gameobject.js';
import clone from 'just-clone';

describe('GameObjectFactory', function() {
	const TEST_DATA = {
		PAAA001_Test1: {
			id: 1,
			index: 'PAAA001',
			name: 'PAAA001_Test1',
			typeinfo: {
				type: 'Type1'
			}
		},
		PAAA002_Test2: {
			id: 2,
			index: 'PAAA002',
			name: 'PAAA002_Test2',
			reference: 'PAAA001_Test1',
			typeinfo: {
				type: 'Type1'
			}
		},
		PAAA003_Test3: {
			id: 3,
			index: 'PAAA003',
			name: 'PAAA003_Test3',
			nested: {
				reference: 'PAAA001_Test1'
			},
			typeinfo: {
				type: 'Type2'
			}
		},
		PAAA004_Test4: {
			id: 4,
			index: 'PAAA004',
			name: 'PAAA004_Test4',
			arr: ['PAAA001_Test1'],
			typeinfo: {
				type: 'Type2'
			}
		},
		PAAA005_Test5: {
			id: 5,
			index: 'PAAA005',
			name: 'PAAA005_Test5',
			nested: {
				arr: ['PAAA002_Test2']
			},
			typeinfo: {
				type: 'Type2'
			}
		}
	};

	let gameObjectFactory;

	beforeEach(function() {
		gameObjectFactory = new GameObjectFactory(TEST_DATA);
	});
	
	describe('.createGameObject', function() {
		let DATA_BEFORE;
		before(function() {
			DATA_BEFORE = clone(TEST_DATA);
		})
		it('should throw an error if no data has been set', function() {
			// Unset data from beforeEach
			gameObjectFactory = new GameObjectFactory(undefined);
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

		it('should be able to retrieve by id', function() {			
			expect(gameObjectFactory.createGameObject(1)).to.exist;
			expect(gameObjectFactory.createGameObject(1).equals(new GameObject(TEST_DATA.PAAA001_Test1))).to.be.true;
		});

		it('should be able to retrieve by reference code', function() {			
			expect(gameObjectFactory.createGameObject('PAAA001')).to.exist;
			expect(gameObjectFactory.createGameObject('PAAA001').equals(new GameObject(TEST_DATA.PAAA001_Test1))).to.be.true;
		});

		it('should be able to retrieve by reference name', function() {			
			expect(gameObjectFactory.createGameObject('PAAA001_Test1')).to.exist;
			expect(gameObjectFactory.createGameObject('PAAA001_Test1').equals(new GameObject(TEST_DATA.PAAA001_Test1))).to.be.true;
		});

		it('should return a GameObject', function() {
			expect(gameObjectFactory.createGameObject('PAAA001')).to.be.an.instanceof(GameObject);
		});

		it('should not have side effects on the source data', function() {
			for (let key in TEST_DATA)
				gameObjectFactory.createGameObject(TEST_DATA[key].id);
			expect(TEST_DATA).to.deep.equal(DATA_BEFORE);
		});
	});

	describe('.attachLabel', function() {
		let labelKeys;
		let DATA_BEFORE;
		before(function() {
			DATA_BEFORE = clone(TEST_DATA);
			labelKeys = GameObjectFactory.LABEL_KEYS;
			GameObjectFactory.LABEL_KEYS = {
				'Type1': 'CONSTANT_LABEL', // Simple lookup
				'Type2': 'LABEL_{typeinfo.type}' // Lookup with interpolation
			}
		});

		after(function() {
			GameObjectFactory.LABEL_KEYS = labelKeys;
		});

		it('should attach a human-readable label by simple lookup', function() {
			gameObjectFactory = new GameObjectFactory(clone(TEST_DATA), { CONSTANT_LABEL: 'constant label' });
			expect(gameObjectFactory.attachLabel(TEST_DATA.PAAA001_Test1)).to.have.property('qb_label', 'constant label');
		});

		it('should attach a human-readable label by interpolated lookup', function() {
			gameObjectFactory = new GameObjectFactory(clone(TEST_DATA), { LABEL_TYPE2: 'interpolated label' });
			expect(gameObjectFactory.attachLabel(TEST_DATA.PAAA003_Test3)).to.have.property('qb_label', 'interpolated label');
		});

		it('should not have side effects on the source data', function() {
			for (let key in TEST_DATA)
				gameObjectFactory.createGameObject(TEST_DATA[key].id);			
			expect(TEST_DATA).to.deep.equal(DATA_BEFORE);
		});
	});

	describe('.expandReferences', function() {
		it('should expand references', function() {
			expect(gameObjectFactory.expandReferences(TEST_DATA.PAAA002_Test2)).to
					.have.property('reference')
					.that.equals(TEST_DATA.PAAA001_Test1);
		});

		it('should not expand blacklisted references', function() {
			expect(GameObjectFactory.IGNORED_KEYS).to.include('name'); // Just to make sure
			expect(gameObjectFactory.expandReferences(TEST_DATA.PAAA001_Test1)).to
				.have.property('name')
				.that.equals(TEST_DATA.PAAA001_Test1.name);
		});

		it('should expand references in nested objects', function() {
			expect(gameObjectFactory.expandReferences(TEST_DATA.PAAA003_Test3))
				.have.nested.property('nested.reference')
				.that.equals(TEST_DATA.PAAA001_Test1);
		});

		it('should expand references in arrays', function() {
			expect(gameObjectFactory.expandReferences(TEST_DATA.PAAA004_Test4))
				.to.have.property('arr')
				.that.is.an('array')
				.with.members([TEST_DATA.PAAA001_Test1]);
		});

		it('should fully expand complex objects', function() {
			expect(gameObjectFactory.expandReferences(TEST_DATA.PAAA005_Test5))
				.to.have.nested.property('nested.arr[0].reference')
				.that.equals(TEST_DATA.PAAA001_Test1);
		});
	});

	describe('.listCodesForType', function() {
		it('should get the reference codes for all objects with a given type', function() {
			expect(gameObjectFactory.listCodesForType('Type1')).to
				.have.members([TEST_DATA.PAAA001_Test1.index, TEST_DATA.PAAA002_Test2.index]);

			expect(gameObjectFactory.listCodesForType('Type2')).to
				.have.members([TEST_DATA.PAAA003_Test3.index, TEST_DATA.PAAA004_Test4.index, TEST_DATA.PAAA005_Test5.index]);
		});
	});

	describe('.deepTransform', function() {
		let DATA_BEFORE;
		before(function() {
			DATA_BEFORE = clone(TEST_DATA);
		});

		it('should turn a simple object with a \'typeinfo\' property into a GameObject', function() {
			expect(gameObjectFactory.deepTransform(TEST_DATA.PAAA001_Test1)).to.be.an.instanceof(GameObject);
		});

		it('should turn nested objects with a \'typeinfo\' property into GameObjects', function() {
			let data = TEST_DATA.PAAA002_Test2;
			data.reference = TEST_DATA.PAAA001_Test1;
			let result = gameObjectFactory.deepTransform(data);
			expect(result.keys()).to.include('reference');
			expect(result.get('reference')).to.be.an.instanceof(GameObject);
		});

		it('should not change primitives', function() {
			expect(gameObjectFactory.deepTransform(1)).to.equal(1);
			expect(gameObjectFactory.deepTransform('string')).to.equal('string');
			expect(gameObjectFactory.deepTransform(true)).to.equal(true);
			expect(gameObjectFactory.deepTransform(null)).to.equal(null);
			expect(gameObjectFactory.deepTransform(undefined)).to.equal(undefined);
		});

		it('should not have side effects on the source data', function() {
			for (let key in TEST_DATA)
				gameObjectFactory.createGameObject(TEST_DATA[key].id);			
			expect(TEST_DATA).to.deep.equal(DATA_BEFORE);
		});
	})	;
});