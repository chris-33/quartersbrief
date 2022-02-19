import { BriefingBuilder } from '../../src/briefing/briefingbuilder.js';
import { GameObjectFactory } from '../../src/model/gameobjectfactory.js';
import { Agenda } from '../../src/briefing/agenda.js';
import { Battle } from '../../src/model/battle.js';
import sinon from 'sinon';
import { readFileSync } from 'fs';
import { valid as isHtml } from 'node-html-parser';

describe('BriefingBuilder', function() {
	let builder;
	let gameObjectFactory;
	let battle;
	let agenda;

	before(function() {
		gameObjectFactory = new GameObjectFactory({});
		sinon.stub(gameObjectFactory, 'createGameObject').returns(null);
		battle = new Battle(JSON.parse(readFileSync('test/model/testdata/battle.json')));
		agenda = new Agenda({}, [ 'testtopic' ]);
	});

	beforeEach(function() {
		builder = new BriefingBuilder(battle, agenda, gameObjectFactory);
		sinon.stub(builder, 'getTopicBuilder');
	});

	afterEach(function() {
		builder.getTopicBuilder.restore();
	});

	it('should throw when trying to create a BriefingBuilder without a battle or an agenda, but not when creating without a GameObjectFactory', function() {
		expect(() => new BriefingBuilder(null, agenda, gameObjectFactory)).to.throw(); // battle is null
		expect(() => new BriefingBuilder(battle, null, gameObjectFactory)).to.throw(); // agenda is null
		expect(() => new BriefingBuilder(battle, agenda, null)).to.not.throw(); // game object factory is null
	});

	describe('.build', function() {
		it('should build an error message if the import cannot be found', async function() {
			builder.getTopicBuilder.rejects();
			sinon.spy(builder, 'buildErrorTopic');
			try {
				await builder.build();
				expect(builder.buildErrorTopic).to.have.been.called;				
			} finally {
				builder.buildErrorTopic.restore();
			}
		});

		it('should call the buildTopic method for a given topic', async function() {
			const buildTopic = sinon.stub();
			builder.getTopicBuilder.resolves({ buildTopic: buildTopic });
			await builder.build();
			expect(buildTopic).to.have.been.called;
			// No need to do buildTopic.restore() because it's an isolated stub, not an object method
		});

		it('should return a promise that resolves to valid HTML', async function() {
			const buildTopic = sinon.stub().returns('<p>topic</p>');
			builder.getTopicBuilder.resolves({ buildTopic: buildTopic });
			return expect(builder.build()).to.eventually.satisfy(isHtml);
			// No need to do buildTopic.restore() because it's an isolated stub, not an object method
		});
	});
});