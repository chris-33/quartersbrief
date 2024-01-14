import GameObjectProvider from '../../src/providers/gameobjectprovider.js';

import mockfs from 'mock-fs';
import fs from 'fs/promises';
import path from 'path';
import omit from 'lodash/omit.js';
import groupBy from 'lodash/groupBy.js';
import zip from 'lodash/zip.js';

describe('Ship @integration', function() {
	let SHIP;

	let gameObjectProvider;
	let ship;

	const SOURCEPATH = '/data';

	before(function() {
		SHIP = {
			ShipAbilities: {},
			ShipUpgradeInfo: {},
			name: 'PAAA001_Test1',
			index: 'PAAA001',
			id: 1,
			level: 8,
			typeinfo: { 
				nation: 'USA',
				species: 'Battleship',
				type: 'Ship'
			}
		}
	});

	beforeEach(function() {
		mockfs({
			[SOURCEPATH]: {
				[`${SHIP.name}.json`]: JSON.stringify(SHIP),
				[`${SHIP.index}.json`]: mockfs.symlink({ path: `${SHIP.name}.json` }),
				[`${SHIP.id}.json`]: mockfs.symlink({ path: `${SHIP.name}.json` })
			}
		});
	});

	afterEach(mockfs.restore);

	beforeEach(async function() {
		const mockLabeler = {
			label: x => x
		}
		gameObjectProvider = new GameObjectProvider(SOURCEPATH, mockLabeler);
	});

	describe('.consumables', function() {
		const CONSUMABLE1 = {
			Flavor1: { prop: 'Flavor01', value: 1, consumableType: 'consumable1' }, 
			name: 'PCY001_Consumable1',
			index: 'PCY001',
			id: 100,
			typeinfo: { 
				nation: 'Common',
				species: null,
				type: 'Ability'
			} 
		}
		const CONSUMABLE2 = {
			Flavor1: { prop: 'Flavor01', value: 2, consumableType: 'consumable2' }, 
			name: 'PCY002_Consumable2',
			index: 'PCY002',
			id: 101,
			typeinfo: { 
				nation: 'Common',
				species: null,
				type: 'Ability'
			} 
		}
		const CONSUMABLE3 = {
			Flavor1: { prop: 'Flavor01', value: 3, consumableType: 'consumable3' }, 
			name: 'PCY003_Consumable3',
			index: 'PCY003',
			id: 102,
			typeinfo: { 
				nation: 'Common',
				species: null,
				type: 'Ability'
			} 
		}
		beforeEach(async function() {
			ship = Object.assign({}, SHIP, { ShipAbilities: {
				AbilitySlot0: {
					abils: [ 
						[ CONSUMABLE1.name, 'Flavor1' ],
						[ CONSUMABLE2.name, 'Flavor1' ] 
					],
					slot: 0
				},
				AbilitySlot1: {
					abils: [ 
						[ CONSUMABLE3.name, 'Flavor1' ] 
					],
					slot: 1
				}
			}});
			await fs.writeFile(path.join(SOURCEPATH, `${ship.name}.json`), JSON.stringify(ship));
			[ CONSUMABLE1, CONSUMABLE2, CONSUMABLE3 ].forEach(async consumable => {
				await fs.writeFile(`${path.join(SOURCEPATH, consumable.name)}.json`, JSON.stringify(consumable));
				await fs.symlink(`${path.join(SOURCEPATH, consumable.name)}.json`, `${path.join(SOURCEPATH, consumable.index)}.json`);
				await fs.symlink(`${path.join(SOURCEPATH, consumable.name)}.json`, `${path.join(SOURCEPATH, String(consumable.id))}.json`);
			});
			ship = await gameObjectProvider.createGameObject(SHIP.name);
		});

		it('should be a hash of all consumables, with the consumableType as the key', function() {
			for (let consumable of [ CONSUMABLE1, CONSUMABLE2, CONSUMABLE3 ]) {
				consumable = Object.assign({}, consumable, consumable.Flavor1);

				expect(ship.consumables, consumable.consumableType).to.have.property(consumable.consumableType);
				expect(ship.consumables[consumable.consumableType]._data).to.deep.equal(consumable);
			}
		});
	});

	describe('.refits', function() {
		const MODULES = {
			AB1_Artillery: {},
			AB1_Engine: {},
			AB2_Engine: {},
			A_AirDefense: {},
			A_Hull: {},
			B_AirDefense: {},
			B_Hull: {},
			AB1_FireControl: {},
			AB2_FireControl: {},
			AB3_FireControl: {},
		}
		const RESEARCH = {
			ART_STOCK: {
				components: { artillery: [ 'AB1_Artillery' ] },
				prev: '',
				ucType: '_Artillery'
			},
			ENG_TOP: {
				components: { engine: [ 'AB2_Engine' ] },
				prev: 'ENG_STOCK',
				ucType: '_Engine'
			},
			ENG_STOCK: {
				components: { engine: [ 'AB1_Engine' ] },
				prev: '',
				ucType: '_Engine'
			},
			HULL_STOCK: {
				components: {
					airDefense: [ 'A_AirDefense' ],
					artillery: [ 'AB1_Artillery' ],
					hull: [ 'A_Hull' ],
				},
				prev: '',
				ucType: '_Hull'
			},
			HULL_TOP: {
				components: {
					airDefense: [ 'B_AirDefense' ],
					artillery: [ 'AB1_Artillery' ],
					hull: [ 'B_Hull' ],				
				},
				prev: 'HULL_STOCK',
				ucType: '_Hull'
			},
			SUO_STOCK: {
				components: { fireControl: [ 'AB1_FireControl' ] },
				prev: '',
				ucType: '_Suo'
			},
			SUO_TOP: {
				components: { fireControl: [ 'AB3_FireControl' ] },
				prev: 'SUO_MIDDLE',
				ucType: '_Suo'
			},
			SUO_MIDDLE: {
				components: { fireControl: [ 'AB2_FireControl' ] },
				prev: 'SUO_STOCK',
				ucType: '_Suo'
			}
		}
		// RESEARCH, transformed into the same shape as ship.refits
		// eslint-disable-next-line mocha/no-setup-in-describe
		const RESEARCH_TRANSFORMED = groupBy(Object.values(RESEARCH)
			.map(research => ({ ...research, ucType: research.ucType[1].toLowerCase() + research.ucType.slice(2) }))
			.sort((research1, research2) => {
				// Sort according to last letter of 'prev' property, leveraging that it can only be
				// '', 'STOCK' or 'MIDDLE' with this test data
				const lastLetter = [ undefined, 'K', 'E' ]
				return lastLetter.indexOf(research1.prev.at(-1)) - lastLetter.indexOf(research2.prev.at(-1));
			}), 'ucType');

		beforeEach(async function() {
			ship = Object.assign({}, SHIP, MODULES, { ShipUpgradeInfo: RESEARCH });
			await fs.writeFile(path.join(SOURCEPATH, `${ship.name}.json`), JSON.stringify(ship));			
			ship = await gameObjectProvider.createGameObject(SHIP.name);
		});

		it('should have all researchable refits for the ship ', async function() {
			const types = Array.from(new Set(Object.keys(RESEARCH_TRANSFORMED)));

			expect(ship.refits, 'all research step types should be there').to.have.all.keys(types);
			types.forEach(type => {
				const line = ship.refits[type];
				const expected = RESEARCH_TRANSFORMED[type].map(research => omit(research, 'components'));

				expect(line.map(refit => omit(refit, 'components')), 'each refit line should have its associated research steps, and in the right order').to.have.deep.ordered.members(expected);
			});
		});

		it('should have the module object instead of the module name for every refit component', function() {
			function* enumerateComponents(research) {
				for (const type in research) {
					const line = research[type];
					for (const refit of line)
						for (const components of Object.values(refit.components))
							for (const module of components)
								yield module;
				}
			}

			// Enumerate the components in ship.refits (expected to be the module objects of the ship), and
			// in RESEARCH_TRANSFORMED (expected to be key names for modules) and create pairs of them.
			// Then assert that each module object is the right one.
			zip(Array.from(enumerateComponents(ship.refits)), Array.from(enumerateComponents(RESEARCH_TRANSFORMED))).forEach(([ mdl, name ]) => 
				expect(mdl).to.equal(ship._data[name]));
		});
	});
});