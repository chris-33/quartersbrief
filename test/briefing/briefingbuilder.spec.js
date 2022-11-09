import BriefingBuilder from '../../src/briefing/briefingbuilder.js';
import { GameObjectFactory } from '../../src/model/gameobjectfactory.js';
import { Agenda } from '../../src/briefing/agenda.js';
import { Battle } from '../../src/model/battle.js';
import sinon from 'sinon';
import { readFileSync } from 'fs';
import pug from 'pug';
import sass from 'sass';
import { valid as isHtml } from 'node-html-parser';
import { validate } from 'csstree-validator';
const isCss = (s) => typeof s === 'string' && validate(s).length === 0;


// Helper function that returns a promise that resolves when the emitter emits the specified event.
function waitFor(emitter, evt) {
	return new Promise(resolve => emitter.on(evt, (...args) => resolve(args)));
}

describe('BriefingBuilder', function() {
	let builder;
	let gameObjectFactory;
	let battle;
	let agenda;

	let buildTopic;

	before(function() {
		gameObjectFactory = new GameObjectFactory({});
		sinon.stub(gameObjectFactory, 'createGameObject').returns(null);
		battle = new Battle(JSON.parse(readFileSync('test/model/testdata/battle.json')));
		agenda = new Agenda({}, { testtopic: {} });
	});

	beforeEach(function() {
		builder = new BriefingBuilder(gameObjectFactory);
		buildTopic = sinon.stub().resolves({})
		sinon.stub(builder, 'getTopicBuilder').resolves({ default: buildTopic });
	});

	describe('.build', function() {
		it('should emit EVT_BRIEFING_START at the beginning', function() {
			const briefing = builder.build(battle, agenda);
			return expect(briefing).to.emit(BriefingBuilder.EVT_BRIEFING_START);
		});

		it('should emit EVT_BRIEFING_FINISH at the end', function() {
			const briefing = builder.build(battle, agenda);
			return expect(briefing).to.emit(BriefingBuilder.EVT_BRIEFING_FINISH);
		});

		it('should build an error message if the import cannot be found', async function() {
			builder.getTopicBuilder.rejects();
			sinon.spy(builder, 'buildErrorTopic');
			try {
				const briefing = builder.build(battle, agenda);
				await waitFor(briefing, BriefingBuilder.EVT_BRIEFING_FINISH);
				expect(builder.buildErrorTopic).to.have.been.called;				
			} finally {
				builder.buildErrorTopic.restore();
			}
		});

		it('should call the buildTopic method for a given topic', async function() {
			await waitFor(builder.build(battle, agenda), BriefingBuilder.EVT_BRIEFING_FINISH);
			
			expect(buildTopic).to.have.been.called;
		});

		it('should pass along options to the topic builder', async function() {
			agenda.topics.testtopic = { option: 'option' };
			
			let expected = agenda.topics.testtopic;
			
			await waitFor(builder.build(battle, agenda), BriefingBuilder.EVT_BRIEFING_FINISH);

			expect(buildTopic).to.have.been.calledWith(sinon.match.any, gameObjectFactory, expected);
		});

		it('should pass separate copies of the battle to each topic builder', async function() {
			const buildTopic1 = sinon.stub().resolves({ html: '' });
			const buildTopic2 = sinon.stub().resolves({ html: '' });
			builder.getTopicBuilder.onFirstCall().resolves({ default: buildTopic1 });
			builder.getTopicBuilder.onSecondCall().resolves({ default: buildTopic2 });

			agenda.topics = { topic1: {}, topic2: {}};

			// Expect both topic builders to have been called:
			await waitFor(builder.build(battle, agenda), BriefingBuilder.EVT_BRIEFING_FINISH);

			expect(buildTopic1).to.have.been.called;
			expect(buildTopic2).to.have.been.called;

			// Expect the "battle" argument of each topic builder to have been deeply equal, but not strictly equal:			
			const battle1 = buildTopic1.firstCall.firstArg;
			const battle2 = buildTopic2.firstCall.firstArg;
			expect(battle1).to.not.equal(battle2);
			expect(battle1).to.deep.equal(battle2);
		});

		it('should emit EVT_BRIEFING_TOPIC when a topic has finished rendering', async function() {
			const topic = { 
				html: '<p>topic</p>', 
				css: 'p { color: red }', 
				caption: 'Topic' 
			}
			buildTopic.returns(topic);

			const expected = {
				html: pug.renderFile('src/briefing/topic.pug', topic),
				css: sass.compileString(`#topic-0 {${topic.css}}`).css
			}

			const briefing = builder.build(battle, agenda);

			// Temporary promise for the waitFor helper function
			// We can't await this directly, because both waitFor and the .emit assertion will
			// register event handlers, and both need to be registered when build is run
			const p = waitFor(briefing, BriefingBuilder.EVT_BRIEFING_TOPIC);
			await expect(briefing).to.emit(BriefingBuilder.EVT_BRIEFING_TOPIC);


			const eventData = await p;
			expect(eventData).to.be.an('array');
			expect(eventData[0]).to.equal(0);
			expect(eventData[1]).to.deep.equal(expected);

			expect(eventData[1].html).to.satisfy(isHtml);
			expect(eventData[1].css).to.satisfy(isCss);
		});
	});
});