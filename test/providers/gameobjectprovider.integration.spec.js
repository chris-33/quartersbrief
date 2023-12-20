import GameObjectProvider from '../../src/providers/gameobjectprovider.js';
import GameObject from '../../src/model/gameobject.js';
import Consumable from '../../src/model/consumable.js';
import Gun from '../../src/model/gun.js';
import mockfs from 'mock-fs';
import fs from 'fs';
import path from 'path';

describe('GameObjectProvider @integration', function() {
	const SOURCEPATH = '/data';
	let CONSUMABLE_DATA;
	const SHIP_DATA = {
		name: 'PAAA001_Test1',
		index: 'PAAA001',
		id: 1,
		ShipUpgradeInfo: {},
		ShipAbilities: { AbilitySlot0: { abils: [] }},
		typeinfo: {
			type: 'Ship'
		}
	};

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
			[ 'index', 'id' ].forEach(link => obj[link] && fs.linkSync(master, path.format({ // For convenience, allow index and/or id to be absent. Then we just won't create that link.
				dir: SOURCEPATH,
				name: obj[link],
				ext: '.json'
			})));
		}
	}

	let gameObjectProvider;

	before(function() {
		CONSUMABLE_DATA = JSON.parse(fs.readFileSync('test/model/testdata/consumable.json')).PCY001_Consumable1;
	});

	beforeEach(function() {
		// Mock labeler that just returns the input when asked to label
		const mockLabeler = {
			label: x => x
		}
		gameObjectProvider = new GameObjectProvider(SOURCEPATH, mockLabeler);
	});
	
	describe('.createGameObject', function() {
		beforeEach(function() {
			mockfs({
				[SOURCEPATH]: {}
			});
		});

		afterEach(function() {
			mockfs.restore();
		});

		// eslint-disable-next-line mocha/no-setup-in-describe
		[ 'name', 'index', 'id'	].forEach(designatorType =>
			it(`should read the game object from disk when requested by ${designatorType}`, async function() {
				populate([ CONSUMABLE_DATA ]);
				
				const gameObject = await gameObjectProvider.createGameObject(CONSUMABLE_DATA[designatorType]);

				expect(gameObject).to.deep.equal(new Consumable(CONSUMABLE_DATA));
			})
		);

		it('should return throw an error if the requested object could not be retrieved', function() {
			// Don't populate source path with anything this time
		
			return expect(gameObjectProvider.createGameObject('PAAA001_Test1')).to.be.rejected;
		});

		describe('processing', function() {
			describe('gun expansion', function() {
				const GUN = {
					typeinfo: {
						type: 'Gun',
						Species: 'Main'
					}
				}
				it('should expand guns\' ammo defitinions', async function() {
					const artillery = {
						AB1_Artillery: {
							HP_AGM_1: {
								...GUN,
								ammoList: [ 'PAAA002_Test2' ],
							}
						}
					};
					const ammo = { 
						name: 'PAAA002_Test2',
						typeinfo: {
							type: 'Projectile',
							species: 'Artillery'
						}
					};
					const ship = Object.assign({}, SHIP_DATA, artillery);
					populate([ ship, ammo ]);

					const result = (await gameObjectProvider.createGameObject(ship.name)).get('AB1_Artillery.HP_AGM_1.ammoList');

					expect(result).to
						.be.an('array').with.lengthOf(1)
						.that.deep.includes(new GameObject(ammo));
				});

				it('should expand inline gun definitions into Gun objects', async function() {
					const artillery = {
						AB1_Artillery: {
							HP_AGM_1: GUN
						}
					};
					const ship = Object.assign({}, SHIP_DATA, artillery);
					populate(ship);

					const result = (await gameObjectProvider.createGameObject(ship.name)).get('AB1_Artillery');

					expect(result).to
						.have.property('HP_AGM_1')
						.that.is.an.instanceOf(Gun)
						.and.deep.equals(new Gun(artillery.AB1_Artillery.HP_AGM_1));
				});
			});

			describe('consumable flavoring @legacy', function() {
				let exposed;
				before(function() {
					exposed = Consumable.EXPOSED_FLAVOR_PROPERTIES;
					Consumable.EXPOSED_FLAVOR_PROPERTIES = ['prop'];
				});
				after(function() {
					Consumable.EXPOSED_FLAVOR_PROPERTIES = exposed;
				})

				it('should set the flavor on the consumable', async function() {
					const abil = [ 'PAAA002_Test2', 'flavor' ];
					const ship = Object.assign({}, SHIP_DATA, {
						ShipAbilities: { 
							AbilitySlot0: {
								abils: [ abil ]
							}
						}
					});
					const consumable = {
						flavor: { prop: 'testproperty' },
						name: 'PAAA002_Test2',
						typeinfo: { type: 'Ability' }
					}
					const expected = new Consumable(consumable);

					expected.setFlavor('flavor');
					populate([ ship, consumable ]);

					const result = (await gameObjectProvider.createGameObject(ship.name)).get('ShipAbilities.AbilitySlot0.abils.0');

					expect(result).to.be.an('array').with.lengthOf(2);
					expect(result[0]).to
						.be.an.instanceOf(Consumable)
						.that.deep.equals(expected);

					expect(() => result.prop).to.not.throw();
				});
			});

			describe.skip('consumable flavoring', function() {
				it('should copy the flavor properties onto the consumable', async function() {
					const abil = [ 'PAAA002_Test2', 'flavor' ];
					const ship = Object.assign({}, SHIP_DATA, {
						ShipAbilities: { 
							AbilitySlot0: {
								abils: [ abil ]
							}
						}
					});
					const consumable = {
						flavor: { prop: 'testproperty' },
						name: 'PAAA002_Test2',
						typeinfo: { type: 'Ability' }
					}
					populate([ ship, consumable ]);

					const result = (await gameObjectProvider.createGameObject(ship.name)).get('ShipAbilities.AbilitySlot0.abils.0');

					expect(result).to
						.be.an.instanceOf(Consumable)
						.that.deep.equals(new Consumable(Object.assign({}, consumable, consumable.flavor)));
				});
			});
		});
	});












	// 	describe('reference expansion', function() {
	// 		const target = {
	// 			id: 1,
	// 			index: 'PAAA001',
	// 			name: 'PAAA001_Test1',
	// 			typeinfo: {
	// 				type: 'Target'
	// 			}
	// 		};
	// 		const referrer = {
	// 			id: 2,
	// 			index: 'PAAA002',
	// 			name: 'PAAA002_Test2',
	// 			reference: 'PAAA001_Test1',
	// 			typeinfo: {
	// 				type: 'Referrer'
	// 			}
	// 		};
	// 		let expansions;
	// 		before(function() {
	// 			expansions = GameObjectProvider.EXPANSIONS;
	// 			GameObjectProvider.EXPANSIONS = {
	// 				Referrer: [
	// 					'reference'
	// 				]
	// 			}
	// 		});
	// 		after(function() {
	// 			GameObjectProvider.EXPANSIONS = expansions;
	// 		});

	// 		it('should expand references to GameObjects', async function() {
	// 			populate([ referrer, target ]);

	// 			const result = await gameObjectProvider.createGameObject('PAAA002_Test2');
	// 			expect(result._data).to
	// 				.have.property('reference')
	// 				.that.deep.equals(new GameObject(target))
	// 				.and.is.an.instanceOf(GameObject);
	// 		});

	// 		it('should "expand" inline references to GameObjects', async function() {
	// 			const inlineReferrer = {
	// 				...referrer,
	// 				reference: target,
	// 			};
	// 			populate(inlineReferrer);

	// 			const result = await gameObjectProvider.createGameObject('PAAA002_Test2');
	// 			expect(result._data).to
	// 				.have.property('reference')
	// 				.that.deep.equals(new GameObject(target))
	// 				.and.is.an.instanceOf(GameObject);
	// 		});

	// 		it('should throw an error if a reference target could not be retrieved', async function() {
	// 			// target is missing from disk
	// 			populate(referrer);

	// 			const result = gameObjectProvider.createGameObject('PAAA002_Test2');
	// 			return expect(result).to.be.rejected;
	// 		});
	// 	});

	// 	describe('conversion', function() {
	// 		const Type1 = class extends GameObject {};
	// 		const Type2 = class extends GameObject {};

	// 		let conversions;
	// 		before(function() {
	// 			conversions = GameObjectProvider.CONVERSIONS;
	// 			GameObjectProvider.CONVERSIONS = {
	// 				'Type1': Type1,
	// 				'Type2': {
	// 					'Species1': Type2
	// 				}
	// 			}
	// 		});
	// 		after(function() {
	// 			GameObjectProvider.CONVERSIONS = conversions;
	// 		});


	// 		it('should convert objects with an unknown typeinfo.type property to instances of GameObject', async function() {
	// 			const obj = {
	// 				id: 1,
	// 				index: 'PAAA001',
	// 				name: 'PAAA001_Test1',
	// 				typeinfo: {
	// 					type: 'Unknown'
	// 				}
	// 			}

	// 			populate(obj);

	// 			const result = await gameObjectProvider.createGameObject(obj.name);
	// 			expect(result).to.be.an.instanceOf(GameObject);
	// 		});

	// 		it('should convert into the correct class as per typeinfo.type', async function() {
	// 			const obj = {
	// 				id: 1,
	// 				index: 'PAAA001',
	// 				name: 'PAAA001_Test1',
	// 				typeinfo: {
	// 					type: 'Type1'
	// 				}
	// 			}

	// 			populate(obj);

	// 			const result = await gameObjectProvider.createGameObject(obj.name);
	// 			expect(result).to.be.an.instanceOf(Type1);
	// 		});

	// 		it('should convert into the correct class as per typeinfo.species if there are several known types for the typeinfo.type', async function() {
	// 			const obj = {
	// 				id: 1,
	// 				index: 'PAAA001',
	// 				name: 'PAAA001_Test1',
	// 				typeinfo: {
	// 					type: 'Type2',
	// 					species: 'Species1'
	// 				}
	// 			}

	// 			populate(obj);

	// 			const result = await gameObjectProvider.createGameObject(obj.name);
	// 			expect(result).to.be.an.instanceOf(Type2);
	// 		});
	// 	});
	// });

});