import mockfs from 'mock-fs';
import esmock from 'esmock';
import TOML from '@iarna/toml';
import GameObjectFactory from '../../src/model/gameobjectfactory.js';
import SpecificityChooser from '../../src/agendas/specificitychooser.js';
import BattleDataReader from '../../src/core/battledatareader.js';
import BriefingController from '../../src/core/briefingcontroller.js';
import AgendaController from '../../src/core/agendacontroller.js';

import { valid as isHtml, parse } from 'node-html-parser';
import { validate } from 'csstree-validator';
const isCss = (s) => typeof s === 'string' && validate(s).length === 0;
import Topic from '../../src/briefing/topic.js';

describe('BriefingController @integration', function() {
	const agendasdir = '/agendas';
	const replaysdir = '/replays';
	let BriefingBuilder;
	let briefingController;

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
	const MOCK_TOPIC_CSS = 'p { color: red; }';

	class MockTopic extends Topic {
		render() { 
			return {
				html: MOCK_TOPIC_HTML,
				css: MOCK_TOPIC_CSS
			}
		}
	}
	before(async function() {
		BriefingBuilder = (await esmock.strict('../../src/briefing/briefingbuilder.js', {
			'../../src/briefing/topics/index.js': { MockTopic }
		})).default;	
	});

	beforeEach(function() {
		mockfs({
			'src/briefing': mockfs.load('src/briefing'),
			[agendasdir]: {
				'mock.toml': TOML.stringify(MOCK_AGENDA)
			},
			[replaysdir]: {
				'tempArenaInfo.json': JSON.stringify(MOCK_TEMP_ARENA_INFO)
			}
		});
	});

	after(function() {
		mockfs.restore();
	});

	beforeEach(async function() {
		const gameObjectFactory = new GameObjectFactory(MOCK_GAME_DATA);

		briefingController = new BriefingController(
			new BattleDataReader(replaysdir),
			new BriefingBuilder({ gameObjectFactory }),
			await AgendaController.create(
				[ agendasdir ],
				new SpecificityChooser(gameObjectFactory)
			)
		);
	});

	it('should construct a briefing from tempArenaInfo.json', async function() {
		const emitter = await briefingController.createBriefing();
		
		const briefing = await new Promise(resolve => emitter.on(BriefingBuilder.EVT_BRIEFING_START, resolve));
		expect(briefing.html, 'briefing should have valid HTML').to.satisfy(isHtml);
		expect(briefing.css, 'briefing should have valid css').to.satisfy(isCss);
		expect(parse(briefing.html).querySelectorAll('.topic'), 'briefing should have a single topic').to.have.lengthOf(1);
		
		const topic = await new Promise(resolve => emitter.on(BriefingBuilder.EVT_BRIEFING_TOPIC, (index, topic) => resolve(topic)));
		expect(topic.html, 'topic\'s html should equal MockTopic\'s output').to.equal(MOCK_TOPIC_HTML);
		// Normalize topic css by removing newlines and trimming whitespace:
		topic.css = topic.css.split(/\s+/).join(' ');
		expect(topic.css, 'topic\'s css should be scoped').to.startWith('#topic-0');
		expect(topic.css, 'topic\'s css should equal MockTopic\'s output').to.contain(MOCK_TOPIC_CSS);

		await expect(emitter, 'should forward EVT_BRIEFING_FINISH').to.emit(BriefingBuilder.EVT_BRIEFING_FINISH);
	});
});