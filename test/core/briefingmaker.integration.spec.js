import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';
import TOML from '@iarna/toml';
import { BriefingMaker } from '../../src/core/briefingmaker.js';
import { GameObjectFactory } from '../../src/model/gameobjectfactory.js';
import { AgendaStore } from '../../src/briefing/agendastore.js';
import SpecificityChooser from '../../src/briefing/specificitychooser.js';
import { valid as isHtml, parse } from 'node-html-parser';
import { validate } from 'csstree-validator';
const isCss = (s) => typeof s === 'string' && validate(s).length === 0;

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
		topics: { 
			mock: {}
		}
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
	const MOCK_TOPIC_SCSS = '$color: red; p { color: $color }';

	before(function() {
		pathExisted = existsSync(mockpath);
		if (!pathExisted) {
			mkdirSync('src/briefing/topics/mock/');
			writeFileSync(path.join(mockpath, 'mock.js'), `export default function buildTopic() { return { html: "${MOCK_TOPIC_HTML}", scss: "${MOCK_TOPIC_SCSS}" }; }`);

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
		let strategy = new SpecificityChooser(gameObjectFactory);
		briefingMaker = new BriefingMaker(os.tmpdir(), gameObjectFactory, agendaStore, strategy);
	});

	it('should construct a briefing from tempArenaInfo.json', async function() {
		let briefing = await briefingMaker.makeBriefing();
		expect(briefing.html, 'briefing should have valid HTML').to.satisfy(isHtml);
		expect(briefing.css, 'briefing should have valid css').to.satisfy(isCss);
		let html = parse(briefing.html);
		expect(html.querySelector('#topic-0'), 'briefing should have a topic').to.exist;
		expect(html.querySelector('#topic-0 .topic-content').innerHTML, 'briefing\'s topic should equal the mock topicBuilder\'s output').to.equal(MOCK_TOPIC_HTML);
	});
});