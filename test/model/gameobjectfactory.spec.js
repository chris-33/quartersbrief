import { GameObjectFactory } from '../../src/model/gameobjectfactory.js';
import { GameObject } from '../../src/model/gameobject.js';
import clone from 'clone';

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
		gameObjectFactory = new GameObjectFactory(clone(TEST_DATA));
	});
	
	describe('.createGameObject', function() {
		it('should throw an error if no data has been set', function() {
			// Unset data from beforeEach
			gameObjectFactory = new GameObjectFactory(undefined);
			expect(gameObjectFactory.createGameObject.bind(gameObjectFactory, 'PAAA001')).to.throw(/No data/);
		});

		it('should throw an error if a malformed designator is passed', function() {
			// Check that a malformed designator causes an exception
			expect(gameObjectFactory.createGameObject.bind(gameObjectFactory, 'malformed')).to.throw(/Invalid argument/);

			// Check that providing no designator at all causes an exception
			expect(gameObjectFactory.createGameObject.bind(gameObjectFactory)).to.throw(/Invalid argument/);
		});

		it('should be able to retrieve a simple object by id', function() {			
			expect(gameObjectFactory.createGameObject(1)).to.deep.equal(new GameObject(TEST_DATA.PAAA001_Test1));
		});

		it('should be able to retrieve a simple object by reference code', function() {			
			expect(gameObjectFactory.createGameObject('PAAA001')).to.deep.equal(new GameObject(TEST_DATA.PAAA001_Test1));
		});

		it('should return a GameObject', function() {
			expect(gameObjectFactory.createGameObject('PAAA001')).to.be.an.instanceof(GameObject);
		});
	});

	describe('._attachLabel', function() {
		let labelKeys;
		before(function() {
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
			expect(gameObjectFactory._attachLabel(TEST_DATA.PAAA001_Test1)).to.have.property('label', 'constant label');
		});

		it('should attach a human-readable label by interpolated lookup', function() {
			gameObjectFactory = new GameObjectFactory(clone(TEST_DATA), { LABEL_TYPE2: 'interpolated label' });
			expect(gameObjectFactory._attachLabel(TEST_DATA.PAAA003_Test3)).to.have.property('label', 'interpolated label');
		});

		it('should attach labels recursively', function() {
			let data = clone(TEST_DATA);
			data.PAAA002_Test2.reference = data.PAAA001_Test1;
			gameObjectFactory = new GameObjectFactory(data, { CONSTANT_LABEL: 'constant label'});
			let obj = gameObjectFactory._attachLabel(data.PAAA002_Test2);
			expect(obj.reference).to.have.property('label');
		});
	});

	describe('._expandReferences', function() {
		it('should expand references', function() {
			expect(gameObjectFactory._expandReferences(TEST_DATA.PAAA002_Test2)).to
				.have.property('reference')
				.that.deep.equals(TEST_DATA.PAAA001_Test1);
		});

		it('should not expand blacklisted references', function() {
			expect(GameObjectFactory.IGNORED_KEYS).to.include('name'); // Just to make sure
			expect(gameObjectFactory._expandReferences(TEST_DATA.PAAA001_Test1)).to
				.have.property('name')
				.that.deep.equals(TEST_DATA.PAAA001_Test1.name);
		});

		it('should expand references in nested objects', function() {
			expect(gameObjectFactory._expandReferences(TEST_DATA.PAAA003_Test3)).to
				.have.nested.property('nested.reference')
				.that.deep.equals(TEST_DATA.PAAA001_Test1);
		});

		it('should expand references in arrays', function() {
			expect(gameObjectFactory._expandReferences(TEST_DATA.PAAA004_Test4)).to
				.have.property('arr')
				.that.is.an('array')
				.that.deep.includes(TEST_DATA.PAAA001_Test1);
		});

		it('should fully expand complex objects', function() {
			expect(gameObjectFactory._expandReferences(TEST_DATA.PAAA005_Test5)).to
				.have.nested.property('nested.arr[0].reference')
				.that.deep.equals(TEST_DATA.PAAA001_Test1);
		});

		it('should change the original data', function() {
			let data = clone(TEST_DATA);
			gameObjectFactory = new GameObjectFactory(data);
			let expanded = gameObjectFactory._expandReferences(TEST_DATA.PAAA002_Test2);
			// Expect that the expanded reference is now present on the SOURCE DATA as well:
			expect(data.PAAA002_Test2).to.deep.equal(expanded);
		});
	});

	describe('._convert', function() {
		it('should convert objects with a typeinfo property to instances of GameObject', function() {
			for (let key in TEST_DATA)
				expect(gameObjectFactory._convert(TEST_DATA[key]), key).to.be.an.instanceof(GameObject);

		});

		it('should convert nested and array objects', function() {
			let data = clone(TEST_DATA);
			// Manually create some expanded references:
			data.PAAA002_Test2.reference = data.PAAA001_Test1;
			data.PAAA002_Test2.nested = { reference: data.PAAA001_Test1 };
			data.PAAA002_Test2.arr = [ data.PAAA001_Test1 ];
			
			let gameObject = gameObjectFactory._convert(data.PAAA002_Test2);

			expect(gameObject._data, 'own property').to.have.property('reference').that.is.an.instanceof(GameObject);
			expect(gameObject._data, 'nested property').to.have.nested.property('nested.reference').that.is.an.instanceof(GameObject);
			expect(gameObject._data).to.have.property('arr').that.is.an('array');
			expect(gameObject._data.arr[0], 'array property').to.be.an.instanceof(GameObject);
		});

		it('should convert into the correct class as per typeinfo.type', function() {
			let knownTypes = GameObjectFactory.KNOWN_TYPES;
			const Type1 = class extends GameObject {};
			const Type2 = class extends GameObject {};
			GameObjectFactory.KNOWN_TYPES = {
				'Type1': Type1,
				'Type2': Type2
			}
			try {
				for (let key in TEST_DATA) {
					let obj = TEST_DATA[key];					
					let expected;
					switch (obj.typeinfo.type) {
						case 'Type1': expected = Type1; break;
						case 'Type2': expected = Type2; break;
						default: expected = GameObject;
					}					
					expect(gameObjectFactory._convert(obj), `${key} should be a ${expected.name}`).to
						.be.an.instanceof(expected);						
				}
				expect(gameObjectFactory._convert({
					typeinfo: { type: 'unknown' }
				}), 'default to GameObject if type unknown').to.be.an.instanceof(GameObject);
			} finally {
				GameObjectFactory.KNOWN_TYPES = knownTypes;
			}
		});

		it('should return values that don\'t have a typeinfo property unchanged', function() {
			for (let val of [{}, [], 1, 'string', true, null, undefined])
				expect(gameObjectFactory._convert(val)).to.equal(val);
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
});