import GameObjectSupplier from '../../src/providers/gameobjectsupplier.js';
import GameObject from '../../src/model/gameobject.js';	
import mockfs from 'mock-fs';
import sinon from 'sinon';
import fs from 'fs';
import path from 'path';

describe('GameObjectSupplier', function() {
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

	let gameObjectSupplier;

	beforeEach(function() {
		gameObjectSupplier = new GameObjectSupplier(SOURCEPATH);
	});
	
	beforeEach(function() {
		mockfs({
			[SOURCEPATH]: {}
		});
	});

	afterEach(mockfs.restore);

	describe('recovery', function() {

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

				const gameObject = await gameObjectSupplier.recover(expected[designatorType]);
				expect(gameObject).to.deep.equal(expected);
			})
		);

		it('should return throw an error if the requested object could not be retrieved', function() {
			// Don't populate source path with anything this time
		
			return expect(gameObjectSupplier.recover('PAAA001_Test1')).to.be.rejected;
		});
	});

	describe('processing', function() {
		let FIXTURE;

		beforeEach(function() {
			FIXTURE = {
				id: 1,
				index: 'PAAA001',
				name: 'PAAA001_Test1',
				typeinfo: {
					type: 'Type1'
				}
			};
			populate(FIXTURE);
		});

		it('should run all processors for the given type', async function() {			
			const processors = {
				'Type1': [
					{ selector: 'id', processors: [ sinon.stub().resolvesArg(0), sinon.stub().resolvesArg(0) ] },
					{ selector: '::root', processors: [ sinon.stub().resolvesArg(0) ] }
				]
			};			
			gameObjectSupplier.processors = processors;

			await gameObjectSupplier.recover(FIXTURE.name);

			processors.Type1
				.flatMap(item => item.processors)
				.forEach(processor => expect(processor).to.have.been.called);
		});

		it('should assign the results of processing to the object\'s property', async function() {
			const expected = 2;
			gameObjectSupplier.processors = {
				'Type1': [
					{ selector: 'id', processors: [ sinon.stub().resolves(expected) ]}
				]
			}

			const result = await gameObjectSupplier.recover(FIXTURE.name);

			expect(result.id).to.equal(expected);
		});

		it('should error as a whole if one of the processors errors', async function() {
			// Test it works with an unambiguous selector
			gameObjectSupplier.processors = {
				'Type1': [ { selector: 'id', processors: [ sinon.stub().rejects() ]} ]
			}
			await expect(gameObjectSupplier.recover(FIXTURE.name), 'unambiguous selector').to.eventually.be.rejected;

			// Test it works with an ambiguous selector
			gameObjectSupplier = new GameObjectSupplier(SOURCEPATH);
			gameObjectSupplier.processors = {
				'Type1': [ { selector: 'i?', processors: [ sinon.stub().rejects() ]} ]
			}
			await expect(gameObjectSupplier.recover(FIXTURE.name), 'ambiguous selector').to.eventually.be.rejected;
		});

		it('should alter the object itself on an empty-selector processor', async function() {
			const expected = {};
			gameObjectSupplier.processors = {
				'Type1': [
					{ selector: '::root', processors: [ sinon.stub().resolves(expected) ]}
				]
			}

			const result = await gameObjectSupplier.recover(FIXTURE.name);

			expect(result).to.equal(expected);
		});
	});

	describe('GameObjectSupplier.Processors', function() {
		it('should be a regular object', function() {
			expect(new GameObjectSupplier.Processors(gameObjectSupplier)).to.not.be.an.instanceOf(GameObjectSupplier.Processors);
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
			let expand;

			beforeEach(function() {
				// "Borrow" the expansion function
				expand = gameObjectSupplier.processors.Ship
					.flat()
					.flatMap(entry => entry.processors)
					.find(proc => proc.name === 'expand');
				gameObjectSupplier.processors.Referrer = [
					{ selector: 'reference', processors: [ expand ] }
				]				
			});


			it('should expand references', async function() {
				populate([ referrer, target ]);

				const result = await gameObjectSupplier.recover('PAAA002_Test2');

				expect(result).to
					.have.property('reference')
					.that.deep.equals(target)
			});

			it('should throw an error if a reference target could not be retrieved', async function() {
				// target is missing from disk
				populate(referrer);

				const result = gameObjectSupplier.recover('PAAA002_Test2');

				return expect(result).to.eventually.be.rejected;
			});
		});

		describe('conversion', function() {
			let convert;
			let conversions;
			class Type1 {}
			class Type2Species1 {}

			before(function() {
				conversions = GameObjectSupplier.Processors.CONVERSIONS;
				GameObjectSupplier.Processors.CONVERSIONS = {
					'Type1': Type1,
					'Type2': {
						'Species1': Type2Species1
					}
				}
			});

			after(function() {
				GameObjectSupplier.Processors.CONVERSIONS = conversions;
			});
			
			beforeEach(function() {
				// "Borrow" the conversion function
				convert = gameObjectSupplier.processors.Ship
					.flat()
					.flatMap(entry => entry.processors)
					.find(proc => proc.name === 'convert');
			});

			it('should convert to the correct class as per typeinfo.type', function() {
				const input = {
					typeinfo: { type: 'Type1' }
				}

				const result = convert(input);

				expect(result).to.be.an.instanceOf(Type1);
			});

			it('should convert to the correct class as per typeinfo.type and typeinfo.species', function() {
				const input = {
					typeinfo: { type: 'Type2', species: 'Species1' }
				}

				const result = convert(input);

				expect(result).to.be.an.instanceOf(Type2Species1);
			});

			it('should convert to GameObject if there is typeinfo but the type is not known', function() {
				const input = {
					typeinfo: { type: 'UnknownType' }
				}

				const result = convert(input);

				expect(result).to.be.an.instanceOf(GameObject);
			});

			it('should return the input unchanged if there is no typeinfo', function() {
				const input = {};

				const result = convert(input);

				expect(result).to.equal(input);
			});

			it('should return the input unchanged if it is already a GameObject', function() {
				const input = new GameObject({});

				const result = convert(input);

				expect(result).to.equal(input);
			});
		});
	});
});