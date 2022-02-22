import { BriefingMaker, ErrorHandlingAgendaStore, BattleDataReader } from '../../src/core/briefingmaker.js';
import { BriefingBuilder } from '../../src/briefing/briefingbuilder.js';
import { AgendaStore } from '../../src/briefing/agendastore.js';
import { Agenda } from '../../src/briefing/agenda.js';
import { GameObjectFactory } from '../../src/model/gameobjectfactory.js';
import mockfs from 'mock-fs';
import sinon from 'sinon';
import { valid as isHtml } from 'node-html-parser';
import pug from 'pug';

describe('.BattleDataReader', function() {
	let battleDataReader;
	
	beforeEach(function() {
		battleDataReader = new BattleDataReader('replays');
	});

	afterEach(function() {
		mockfs.restore();
	})

	it('should read the file contents', function() {
		mockfs({ replays: { 'tempArenaInfo.json': '{ "n": 5 }' }});
		return expect(battleDataReader.read()).to.eventually.deep.equal({ n: 5 });
	});

	it('should be able to recover from missing file and return null', function() {
		mockfs({ replays: {} });
		return expect(battleDataReader.read()).to.eventually.be.null;
	});

	it('should recover from missing permissions and return null', function() {
		mockfs({ replays: {
			'tempArenaInfo.json': mockfs.file({
				mode: 0 // No one has any permissions whatsoever
			})
		}});
		return expect(battleDataReader.read()).to.eventually.be.null;
	});
});


describe('.ErrorHandlingAgendaStore', function() { // eslint-disable-line mocha/max-top-level-suites
	let errorHandlingAgendaStore;

	beforeEach(function() {
		errorHandlingAgendaStore = new ErrorHandlingAgendaStore(new AgendaStore('agendas'));
	});

	afterEach(function() {
		mockfs.restore();
	});

	it('should return the results of the wrapped AgendaStore when available', async function() {
		mockfs({ agendas: { agenda: 'n=5' }});
		let agendaStore = new AgendaStore('agendas');
		let expected = await agendaStore.getAgendas();
		return expect(errorHandlingAgendaStore.getAgendas()).to.eventually.be.an('array').with.deep.members(expected);
	});

	it('should recover from non-existent director by returning []', function() {
		mockfs({});
		return expect(errorHandlingAgendaStore.getAgendas()).to.eventually.be.an('array').that.is.empty;
	});

	it('should recover from missing permissions by returning []', function() {
		mockfs({ agendas: mockfs.directory({ mode: 0 })});
		return expect(errorHandlingAgendaStore.getAgendas()).to.eventually.be.an('array').that.is.empty;
	});
});

describe('BriefingMaker', function() {
	let briefingMaker;

	beforeEach(function() {
		let agendaStore = new AgendaStore();
		sinon.stub(agendaStore, 'getAgendas').returns([]);
		
		let gameObjectFactory = new GameObjectFactory({});
		sinon.stub(gameObjectFactory, 'createGameObject').returns(null);
		
		sinon.stub(BattleDataReader.prototype, 'read').resolves({ "vehicles": [ { "shipId": 1 }, { "shipId": 2 } ] });
		briefingMaker = new BriefingMaker('replays', gameObjectFactory, agendaStore, { chooseAgenda: sinon.stub().returns(new Agenda(null, [ 'mock' ])) });
	});

	afterEach(function() {
		BattleDataReader.prototype.read.restore();
	});
	
	it('should create valid HTML', function() {
		return expect(briefingMaker.makeBriefing()).to.eventually.satisfy(isHtml);
	});

	it('should enrich the battle', async function() {
		// We check this assertion by creating a fake topic builder which will be passed the battle
		// We can then sure that the battle was enriched
		let buildTopic = sinon.stub();
		sinon.stub(BriefingBuilder.prototype, 'getTopicBuilder').resolves({ buildTopic });
		try {
			await briefingMaker.makeBriefing();
			expect(buildTopic).to.have.been.called;
			let battle = buildTopic.firstCall.args[0];
			// Check that battle.vehicles' entries have been enriched with a ship property
			expect(battle.get('vehicles.0')).to.have.property('ship');
			expect(battle.get('vehicles.1')).to.have.property('ship');
		} finally { 
			BriefingBuilder.prototype.getTopicBuilder.restore(); 
		}
	});

	it('should render the "no battle" template when the BattleDataReader returned null', function() {
		BattleDataReader.prototype.read.returns(null);
		let expected = pug.renderFile('src/briefing/no-battle.pug');
		return expect(briefingMaker.makeBriefing()).to.eventually.equal(expected);
	});

	it('should render the "no agendas" template when the choose strategy returned null', function() {
		briefingMaker.strategy.chooseAgenda.returns(null);
		let expected = pug.renderFile('src/briefing/no-agenda.pug');
		return expect(briefingMaker.makeBriefing()).to.eventually.equal(expected);
	});	
});