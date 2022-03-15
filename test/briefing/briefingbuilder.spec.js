import { BriefingBuilder } from '../../src/briefing/briefingbuilder.js';
import { GameObjectFactory } from '../../src/model/gameobjectfactory.js';
import { Agenda } from '../../src/briefing/agenda.js';
import { Battle } from '../../src/model/battle.js';
import { Ship } from '../../src/model/ship.js';
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
		agenda = new Agenda({}, { testtopic: {} });
	});

	beforeEach(function() {
		builder = new BriefingBuilder(gameObjectFactory);
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

		it('should pass separate copies of the battle to each topic builder', async function() {
			const buildTopic1 = sinon.stub().resolves({ html: '' });
			const buildTopic2 = sinon.stub().resolves({ html: '' });
			builder.getTopicBuilder.onFirstCall().resolves({ default: buildTopic1 });
			builder.getTopicBuilder.onSecondCall().resolves({ default: buildTopic2 });

			agenda.topics = { topic1: {}, topic2: {}};
			battle.getVehicles().forEach(vehicle => vehicle.ship = new Ship({ShipUpgradeInfo:{}}));

			// Expect both topic builders to have been called:
			await builder.build(battle, agenda);
			expect(buildTopic1).to.have.been.called;
			expect(buildTopic2).to.have.been.called;

			// Expect the "battle" argument of each topic builder to have been deeply equal, but not strictly equal:			
			await builder.build(battle, agenda);
			expect(buildTopic1).to.have.been.called;
			expect(buildTopic2).to.have.been.called;
			
			const battle1 = buildTopic1.firstCall.firstArg;
			const battle2 = buildTopic2.firstCall.firstArg;
			expect(battle1).to.not.equal(battle2);
			expect(battle1).to.deep.equal(battle2);

			// Check that all ships are copies, too:
			const vehicles1 = battle1.getVehicles();
			const vehicles2 = battle2.getVehicles();
			expect(vehicles1).to.have.lengthOf(vehicles2.length);
			for (let i = 0; i < vehicles1.length; i++) {
				expect(vehicles1[i].ship).to.not.equal(vehicles2[i].ship);
				expect(vehicles1[i].ship).to.deep.equal(vehicles2[i].ship);
			}
		});

		it('should pass along options to the topic builder', async function() {
			const buildTopic = sinon.stub().returns({});
			builder.getTopicBuilder.resolves({ default: buildTopic });
			agenda.topics.testtopic = { option: 'option' };
			let expected = agenda.topics.testtopic;
			await builder.build(battle, agenda);
			expect(buildTopic).to.have.been.calledWith(sinon.match.any, gameObjectFactory, expected);
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