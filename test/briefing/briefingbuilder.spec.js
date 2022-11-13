import Topic from '../../src/briefing/topic.js';
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

	const MockTopic = class extends Topic {};	

	before(function() {
		gameObjectFactory = new GameObjectFactory({});
		sinon.stub(gameObjectFactory, 'createGameObject').returns(null);
	});

	beforeEach(function() {
		battle = new Battle(JSON.parse(readFileSync('test/model/testdata/battle.json')));
		agenda = new Agenda({}, { testtopic: {} });
	});

	beforeEach(function() {
		builder = new BriefingBuilder({ gameObjectFactory });
		sinon.stub(builder, 'getTopic').resolves({ default: MockTopic });		
		sinon.stub(MockTopic.prototype);
		MockTopic.prototype.render.resolves({
			html: '<p>topic </p>',
			css: 'p { color: red; }'
		});
	});

	afterEach(function() {
		sinon.restore();
	});

	describe('.build', function() {
		it('should build an error message if the import cannot be found', async function() {
			builder.getTopic.rejects();
			sinon.spy(builder, 'buildErrorTopic');
			try {
				await builder.build(battle, agenda);
				expect(builder.buildErrorTopic).to.have.been.called;				
			} finally {
				builder.buildErrorTopic.restore();
			}
		});

		it('should instantiate the Topic subclass for the given topic and call render() on it', async function() {
			await builder.build(battle, agenda);
			expect(MockTopic.prototype.render).to.have.been.called;
		});

		it('should pass along the agenda options to the topic builder', async function() {
			agenda.topics.testtopic = { option: 'option' };
			let expected = agenda.topics.testtopic;
			await builder.build(battle, agenda);
			expect(MockTopic.prototype.render).to.have.been.calledWith(sinon.match.any, expected);
		});

		it('should pass separate copies of the battle to each topic builder', async function() {
			agenda.topics = { topic1: {}, topic2: {}};

			// Expect both topic builders to have been called:
			await builder.build(battle, agenda);
			expect(MockTopic.prototype.render).to.have.been.calledTwice;

			// Expect the "battle" argument of each topic builder to have been deeply equal, but not strictly equal:			
			const battle1 = MockTopic.prototype.render.firstCall.firstArg;
			const battle2 = MockTopic.prototype.render.secondCall.firstArg;
			expect(battle1).to.not.equal(battle2);
			expect(battle1).to.deep.equal(battle2);
		});

		it('should return a promise that resolves to a briefing object with valid HTML', async function() {
			return expect(builder.build(battle, agenda)).to.eventually
				.have.property('html')
				.that.satisfies(isHtml);
		});

		it('should return a promise that resolves to a briefing object with valid CSS', async function() {
			return expect(builder.build(battle, agenda)).to.eventually
				.have.property('css')
				.that.satisfies(isCss);
		});
	});
});