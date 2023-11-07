import GameObjectProvider from '../../src/providers/gameobjectprovider.js';
import GameObject from '../../src/model/gameobject.js';
import mockfs from 'mock-fs';
import fs from 'fs';
import path from 'path';

describe('GameObjectProvider', function() {
	const SOURCEPATH = '/data';

	// Helper function to populate the source path with the game objects in the array `data`.
	// For convenience, if there is only one object, it can be passed directly instead of as an array.
	function populate(data) {
		if (!Array.isArray(data)) data = [ data ];

		for (let obj of data) {
			const master = path.format({
				dir: SOURCEPATH,
				name: obj.name,
				ext: '.json'
			});
			fs.writeFileSync(master, JSON.stringify(obj));
			[ 'index', 'id' ].forEach(link => fs.linkSync(master, path.format({
				dir: SOURCEPATH,
				name: obj[link],
				ext: '.json'
			})));
		}
	}

	let gameObjectProvider;

	beforeEach(function() {
		gameObjectProvider = new GameObjectProvider(SOURCEPATH);
	});
	
	describe('.createGameObject', function() {
		beforeEach(function() {
			mockfs({
				[SOURCEPATH]: {}
			})
		});

		afterEach(function() {
			mockfs.restore();
		});

		// eslint-disable-next-line mocha/no-setup-in-describe
		[ 'name', 'index', 'id'	].forEach(designatorType =>
			it(`should read the game object from disk when requested by ${designatorType}`, async function() {
				const expected = {
					id: 1,
					index: 'PAAA001',
					name: 'PAAA001_Test1',
					typeinfo: {
						type: 'Type1'
					}
				}

				populate(expected);

				const gameObject = await gameObjectProvider.createGameObject(expected[designatorType]);
				expect(gameObject).to.deep.equal(new GameObject(expected));
			})
		);

		it('should return throw an error if the requested object could not be retrieved', function() {
			// Don't populate source path with anything this time
		
			return expect(gameObjectProvider.createGameObject('PAAA001_Test1')).to.be.rejected;
		});

		it('should always return a fresh instance', async function() {
				const obj = {
					id: 1,
					index: 'PAAA001',
					name: 'PAAA001_Test1',
					typeinfo: {
						type: 'Type1'
					}
				}

				populate(obj);

				const gameObject1 = await gameObjectProvider.createGameObject(obj.name);
				const gameObject2 = await gameObjectProvider.createGameObject(obj.name);
				
				expect(gameObject1).to.not.equal(gameObject2);
				expect(gameObject1).to.deep.equal(gameObject2);
		});

		it('should throw an error if a malformed designator is passed', async function() {
			// Check that a malformed designator causes an exception
			await expect(gameObjectProvider.createGameObject('malformed')).to.be.rejectedWith(/Invalid argument/);

			// Check that providing no designator at all causes an exception
			await expect(gameObjectProvider.createGameObject(gameObjectProvider)).to.be.rejectedWith(/Invalid argument/);
		});

		describe('reference expansion', function() {
			const target = {
				id: 1,
				index: 'PAAA001',
				name: 'PAAA001_Test1',
				typeinfo: {
					type: 'Target'
				}
			};
			const referrer = {
				id: 2,
				index: 'PAAA002',
				name: 'PAAA002_Test2',
				reference: 'PAAA001_Test1',
				typeinfo: {
					type: 'Referrer'
				}
			};
			let expansions;
			before(function() {
				expansions = GameObjectProvider.EXPANSIONS;
				GameObjectProvider.EXPANSIONS = {
					Referrer: [
						'reference'
					]
				}
			});
			after(function() {
				GameObjectProvider.EXPANSIONS = expansions;
			});

			it('should expand references to GameObjects', async function() {
				populate([ referrer, target ]);

				const result = await gameObjectProvider.createGameObject('PAAA002_Test2');
				expect(result._data).to
					.have.property('reference')
					.that.deep.equals(new GameObject(target))
					.and.is.an.instanceOf(GameObject);
			});

			it('should "expand" inline references to GameObjects', async function() {
				const inlineReferrer = {
					...referrer,
					reference: target,
				};
				populate(inlineReferrer);

				const result = await gameObjectProvider.createGameObject('PAAA002_Test2');
				expect(result._data).to
					.have.property('reference')
					.that.deep.equals(new GameObject(target))
					.and.is.an.instanceOf(GameObject);
			});

			it('should throw an error if a reference target could not be retrieved', async function() {
				// target is missing from disk
				populate(referrer);

				const result = gameObjectProvider.createGameObject('PAAA002_Test2');
				return expect(result).to.be.rejected;
			});
		});

		describe('conversion', function() {
			const Type1 = class extends GameObject {};
			const Type2 = class extends GameObject {};

			let conversions;
			before(function() {
				conversions = GameObjectProvider.CONVERSIONS;
				GameObjectProvider.CONVERSIONS = {
					'Type1': Type1,
					'Type2': {
						'Species1': Type2
					}
				}
			});
			after(function() {
				GameObjectProvider.CONVERSIONS = conversions;
			});


			it('should convert objects with an unknown typeinfo.type property to instances of GameObject', async function() {
				const obj = {
					id: 1,
					index: 'PAAA001',
					name: 'PAAA001_Test1',
					typeinfo: {
						type: 'Unknown'
					}
				}

				populate(obj);

				const result = await gameObjectProvider.createGameObject(obj.name);
				expect(result).to.be.an.instanceOf(GameObject);
			});

			it('should convert into the correct class as per typeinfo.type', async function() {
				const obj = {
					id: 1,
					index: 'PAAA001',
					name: 'PAAA001_Test1',
					typeinfo: {
						type: 'Type1'
					}
				}

				populate(obj);

				const result = await gameObjectProvider.createGameObject(obj.name);
				expect(result).to.be.an.instanceOf(Type1);
			});

			it('should convert into the correct class as per typeinfo.species if there are several known types for the typeinfo.type', async function() {
				const obj = {
					id: 1,
					index: 'PAAA001',
					name: 'PAAA001_Test1',
					typeinfo: {
						type: 'Type2',
						species: 'Species1'
					}
				}

				populate(obj);

				const result = await gameObjectProvider.createGameObject(obj.name);
				expect(result).to.be.an.instanceOf(Type2);
			});
		});
	});

});