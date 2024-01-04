import Topic from '../../src/briefing/topic.js';
import BriefingBuilder from '../../src/briefing/briefingbuilder.js';
import GameObjectProvider from '../../src/providers/gameobjectprovider.js';
import Agenda from '../../src/agendas/agenda.js';
import Battle from '../../src/model/battle.js';
import sinon from 'sinon';
import { readFileSync } from 'fs';
import { valid as isHtml } from 'node-html-parser';
import { validate } from 'csstree-validator';
const isCss = (s) => typeof s === 'string' && validate(s).length === 0;


// Helper function that returns a promise that resolves when the emitter emits the specified event.
function waitFor(emitter, evt) {
	return new Promise(resolve => emitter.on(evt, (...args) => resolve(args)));
}

describe('BriefingBuilder', function() {
	let builder;
	let gameObjectProvider;
	let battle;
	let agenda;

	const rendered = {
		html: '<p>topic</p>',
		css: 'p { color: red; }'
	}
	const MockTopic = class extends Topic {};	

	beforeEach(function() {
		gameObjectProvider = new GameObjectProvider({});
		sinon.stub(gameObjectProvider, 'createGameObject').resolves({ 
			getTier: () => 0, 
			getLabel: () => ''
		});
		gameObjectProvider.labeler = {
			labels: {}
		}
	});

	beforeEach(function() {
		battle = new Battle(JSON.parse(readFileSync('test/model/testdata/battle.json')));
		agenda = new Agenda({}, { testtopic: {} });
	});

	beforeEach(function() {
		builder = new BriefingBuilder({ gameObjectProvider });
		sinon.stub(builder, 'getTopic').returns(MockTopic);
		sinon.stub(MockTopic.prototype);
		MockTopic.prototype.render.resolves(rendered);
	});

	afterEach(function() {
		sinon.restore();
	});

	describe('.build', function() {
		it('should emit EVT_BRIEFING_START at the beginning', async function() {			
			const briefing = builder.build(battle, agenda);
			const data = waitFor(briefing, BriefingBuilder.EVT_BRIEFING_START);
			await expect(briefing).to.emit(BriefingBuilder.EVT_BRIEFING_START);
			await expect(data).to.eventually.be.an('array').with.members([briefing]);
		});

		it('should emit EVT_BRIEFING_FINISH at the end', async function() {
			const briefing = builder.build(battle, agenda);
			const data = waitFor(briefing, BriefingBuilder.EVT_BRIEFING_FINISH);
			await expect(briefing).to.emit(BriefingBuilder.EVT_BRIEFING_FINISH);
			await expect(data).to.eventually.be.an('array').with.members([briefing]);
		});

		it('should build an error message if there is an error while rendering the briefing scaffolding', async function() {
			const err = new Error();
			gameObjectProvider.createGameObject.rejects(err);

			const briefing = builder.build(battle, agenda);
			await waitFor(briefing, BriefingBuilder.EVT_BRIEFING_TOPIC);
			await waitFor(briefing, BriefingBuilder.EVT_BRIEFING_FINISH);
			expect(briefing.html).to.contain('error')
		});

		it('should build an error message if the topic builder has an error', async function() {
			MockTopic.prototype.render.rejects();		
			sinon.spy(builder, 'buildErrorTopic');
			try {
				const briefing = builder.build(battle, agenda);
				await waitFor(briefing, BriefingBuilder.EVT_BRIEFING_TOPIC);
				await waitFor(briefing, BriefingBuilder.EVT_BRIEFING_FINISH);
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
			await waitFor(builder.build(battle, agenda), BriefingBuilder.EVT_BRIEFING_FINISH);
			expect(MockTopic.prototype.render).to.have.been.calledWith(sinon.match.any, expected);
		});

		it('should pass separate copies of the battle to each topic builder', async function() {
			agenda.topics = { topic1: {}, topic2: {}};

			// Expect both topic builders to have been called:
			await waitFor(builder.build(battle, agenda), BriefingBuilder.EVT_BRIEFING_FINISH);
			expect(MockTopic.prototype.render).to.have.been.calledTwice;

			// Expect the "battle" argument of each topic builder to have been deeply equal, but not strictly equal:			
			const battle1 = MockTopic.prototype.render.firstCall.firstArg;
			const battle2 = MockTopic.prototype.render.secondCall.firstArg;
			expect(battle1).to.not.equal(battle2);
			expect(battle1._data).to.deep.equal(battle2._data);
		});

		it('should emit EVT_BRIEFING_TOPIC when a topic has finished rendering', async function() {
			const briefing = builder.build(battle, agenda);

			// Temporary promise for the waitFor helper function
			// We can't await this directly, because both waitFor and the .emit assertion will
			// register event handlers, and both need to be registered when build is run
			const p = waitFor(briefing, BriefingBuilder.EVT_BRIEFING_TOPIC);
			await expect(briefing).to.emit(BriefingBuilder.EVT_BRIEFING_TOPIC);


			const eventData = await p;
			expect(eventData).to.be.an('array');
			expect(eventData[0]).to.equal(briefing.id);
			expect(eventData[1]).to.equal(0);
			expect(eventData[2]).to.deep.equal(rendered);

			expect(eventData[2].html).to.satisfy(isHtml);
			expect(eventData[2].css).to.satisfy(isCss);
		});
	});
});