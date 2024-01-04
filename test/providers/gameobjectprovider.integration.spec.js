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

				expect(gameObject._data).to.deep.equal(CONSUMABLE_DATA);
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

					const result = (await gameObjectProvider.createGameObject(ship.name))._data.AB1_Artillery.HP_AGM_1._data.ammoList;

					expect(result).to.be.an('array').with.lengthOf(1);
					expect(result[0]._data).to.deep.equal(ammo);
				});

				it('should expand inline gun definitions into Gun objects', async function() {
					const artillery = {
						AB1_Artillery: {
							HP_AGM_1: GUN
						}
					};
					const ship = Object.assign({}, SHIP_DATA, artillery);
					populate(ship);

					const result = (await gameObjectProvider.createGameObject(ship.name))._data.AB1_Artillery;

					expect(result).to
						.have.property('HP_AGM_1')
						.that.is.an.instanceOf(Gun);
					expect(result.HP_AGM_1._data).to
						.deep.equal(artillery.AB1_Artillery.HP_AGM_1);
				});
			});

			describe('consumable flavoring', function() {
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

					const result = (await gameObjectProvider.createGameObject(ship.name))._data.ShipAbilities.AbilitySlot0.abils[0];

					expect(result).to.be.an.instanceOf(Consumable);
					expect(result._data).to.deep.equal(Object.assign({}, consumable, consumable.flavor));
				});
			});

			describe('ship research lines', function() {
				it('should build the ship\'s research tree', async function() {
					const stock = {
						canBuy: true,
						components: {
							engine: [ 'AB1_Engine' ]
						},
						nextShips: [],
						prev: '',
						ucType: '_Engine'
					}
					const top = {
						canBuy: true,
						components: {
							engine: [ 'AB2_Engine' ]
						},
						nextShips: [],
						prev: 'ENG_STOCK',
						ucType: '_Engine'
					}
					const ship = Object.assign({}, SHIP_DATA, {
						ShipUpgradeInfo: {
							ENG_TOP: top,
							ENG_STOCK: stock,
						}
					});
					populate(ship);

					const result = (await gameObjectProvider.createGameObject(ship.name))._data.ShipUpgradeInfo;

					expect(result).to
						.be.an('object').with.property('_Engine')
						.that.is.an('array').with.deep.ordered.members([ stock, top ]);
				});
			});
		});
	});
});