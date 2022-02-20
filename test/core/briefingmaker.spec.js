import { BriefingMaker, BattleDataReader, ErrorHandlingAgendaStore } from '../../src/core/briefingmaker.js';
import { AgendaStore } from '../../src/briefing/agendastore.js';
import { BriefingBuilder } from '../../src/briefing/briefingbuilder.js';
import { GameObjectFactory } from '../../src/model/gameobjectfactory.js';
import mockfs from 'mock-fs';
import sinon from 'sinon';

describe('BattleDataReader', function() {
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

describe('ErrorHandlingAgendaStore', function() { // eslint-disable-line mocha/max-top-level-suites
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
		sinon.stub(gameObjectFactory, 'createGameObject').returnsArg(0);
		briefingMaker = new BriefingMaker(null, agendaStore, gameObjectFactory);
	});
	
	it('should create valid HTML');
	it('should enrich the battle');
});