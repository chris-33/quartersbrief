import { BriefingBuilder } from '../../src/briefing/briefingbuilder.js';
import { GameObjectFactory } from '../../src/model/gameobjectfactory.js';
import { Agenda } from '../../src/briefing/agenda.js';
import { Battle } from '../../src/model/battle.js';
import sinon from 'sinon';
import { readFileSync } from 'fs';
import { valid as isHtml } from 'node-html-parser';
import { validate } from 'csstree-validator';
const isCss = (s) => typeof s === 'string' && validate(s).length === 0;

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

	describe('.build', function() {
		it('should build an error message if the import cannot be found', async function() {
			builder.getTopicBuilder.rejects();
			sinon.spy(builder, 'buildErrorTopic');
			try {
				await builder.build(battle, agenda);
				expect(builder.buildErrorTopic).to.have.been.called;				
			} finally {
				builder.buildErrorTopic.restore();
			}
		});

		it('should call the buildTopic method for a given topic', async function() {
			const buildTopic = sinon.stub().returns({});
			builder.getTopicBuilder.resolves({ default: buildTopic });
			await builder.build(battle, agenda);
			expect(buildTopic).to.have.been.called;
			// No need to do buildTopic.restore() because it's an isolated stub, not an object method
		});

		it('should return a promise that resolves to a briefing object with valid HTML', async function() {
			const buildTopic = sinon.stub().resolves({ html: '<p>topic</p>'});
			builder.getTopicBuilder.resolves({ default: buildTopic });
			return expect(builder.build(battle, agenda)).to.eventually
				.have.property('html')
				.that.eventually.satisfies(isHtml);
			// No need to do buildTopic.restore() because it's an isolated stub, not an object method
		});

		it('should return a promise that resolves to a briefing object with valid CSS', async function() {
			const buildTopic = sinon.stub().resolves({ scss: 'p { color: red }'});
			builder.getTopicBuilder.resolves({ default: buildTopic });
			return expect(builder.build(battle, agenda)).to.eventually
				.have.property('css')
				.that.eventually.satisfies(isCss);
			// No need to do buildTopic.restore() because it's an isolated stub, not an object method
		});

	});
});