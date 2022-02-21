import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';
import TOML from '@iarna/toml';
import { BriefingMaker } from '../../src/core/briefingmaker.js';
import { GameObjectFactory } from '../../src/model/gameobjectfactory.js';
import { AgendaStore } from '../../src/briefing/agendastore.js';
import { SpecificityStrategy } from '../../src/briefing/specificitystrategy.js';
import { valid as isHtml, parse } from 'node-html-parser';

describe('BriefingMaker @integration', function() {
	let pathExisted;
	const mockpath = 'src/briefing/topics/mock';
	let briefingMaker;

	const MOCK_GAME_DATA = {
		PAAA001_Battleship: {
			name: 'PAAA001_Battleship',
			index: 'PAAA001',
			id: 1,
			level: 8,
			ShipUpgradeInfo: {},
			ShipAbilities: [],
			typeinfo: { 
				nation: 'USA',
				species: 'Battleship',
				type: 'Ship'
			}
		},
		PAAA002_Cruiser: {
			name: 'PAAA002_Cruiser',
			index: 'PAAA002',
			id: 2,
			level: 7,
			ShipUpgradeInfo: {},
			ShipAbilities: [],
			typeinfo: { 
				nation: 'Germany',
				species: 'Cruiser',
				type: 'Ship'
			}			
		}
	}
	const MOCK_AGENDA = {
		matches: {},
		topics: [ 'mock' ]
	}
	const MOCK_TEMP_ARENA_INFO = {
		playerID: 0,
		vehicles: [
			{ shipId: 1, id: 1, relation: 0, name: 'player' },
			{ shipId: 2, id: 2, relation: 1, name: 'ally1' },
			{ shipId: 2, id: 3, relation: 2, name: 'enemy1' },
			{ shipId: 1, id: 4, relation: 2, name: 'enemy2' },
		],
		playerVehicle: 'PAAA001_Battleship'
	}
	const MOCK_TOPIC_HTML = '<p>Mock topic</p>';
	before(function() {
		pathExisted = existsSync(mockpath);
		if (!pathExisted) {
			mkdirSync('src/briefing/topics/mock/');
			writeFileSync(path.join(mockpath, 'mock.js'), `function buildTopic() { return "${MOCK_TOPIC_HTML}"; }\nexport { buildTopic }`);

			writeFileSync(path.join(os.tmpdir(), 'tempArenaInfo.json'), JSON.stringify(MOCK_TEMP_ARENA_INFO));

			mkdirSync(path.join(os.tmpdir(), 'agendas'));
			writeFileSync(path.join(os.tmpdir(), 'agendas', 'agenda'), TOML.stringify(MOCK_AGENDA));
		} else
			expect.fail('Path for mock topic builder already existed');
	});

	after(function() {
		if (!pathExisted) {
			rmSync(mockpath, { recursive: true, force: true });

			rmSync(path.join(os.tmpdir(), 'tempArenaInfo.json'));
			rmSync(path.join(os.tmpdir(), 'agendas'), { recursive: true, force: true });
		}
	});

	beforeEach(function() {
		let gameObjectFactory = new GameObjectFactory(MOCK_GAME_DATA);
		let agendaStore = new AgendaStore(path.join(os.tmpdir(), 'agendas'));
		briefingMaker = new BriefingMaker(os.tmpdir(), gameObjectFactory, agendaStore, new SpecificityStrategy());
	});

	it('should construct a briefing from tempArenaInfo.json', async function() {
		let briefing = await briefingMaker.makeBriefing();
		expect(briefing, 'briefing should be valid HTML').to.satisfy(isHtml);
		let html = parse(briefing);		
		expect(html.querySelector('#topic-0'), 'briefing should have a topic').to.exist;
		expect(html.querySelector('#topic-0').innerHTML, 'briefing\'s topic should equal the mock topicBuilder\'s output').to.equal(MOCK_TOPIC_HTML);
	});
});