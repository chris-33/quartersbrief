import { AgendaFactory } from '../../src/briefing/agendafactory.js';
import { Agenda } from '../../src/briefing/agenda.js';
import { Ship } from '../../src/model/ship.js';
import mockfs from 'mock-fs';
import { readFileSync } from 'fs';
import TOML from '@iarna/toml';
import sinon from 'sinon';

describe('AgendaFactory', function() {
	let TEST_DATA;
	let agendaFactory;

	before(function() {
		// "before" hooks run before beforeEach hooks, so this will still read from the real filesystem
		TEST_DATA = JSON.parse(readFileSync('test/briefing/testdata/agendas.json'));
	});

	beforeEach(function() {
		agendaFactory = new AgendaFactory('agendas');		

		let files = {};
		// Create fake files from TEST_DATA and "store" them with mock-fs 
		// for getAgendas() to read
		for (let i = 0; i < TEST_DATA.length; i++) 
			files[`agenda${i}`] = TOML.stringify(TEST_DATA[i]);		
		// Create a mock directory "agendas" that contains the files
		mockfs({ 'agendas': files });
	});

	afterEach(function() {
		mockfs.restore();
	});

	describe('.getAgendas', function() {
		it('should throw if the agendas path does not exist', function() {
			agendaFactory = new AgendaFactory('doesnotexist');
			return expect(agendaFactory.getAgendas()).to.eventually.be.rejected;
		});

		it('should return an empty array if there are no agenda files', function() {
			mockfs({ 'emptydir': {} });
			agendaFactory = new AgendaFactory('emptydir');
			return expect(agendaFactory.getAgendas()).to.eventually.be.an('array').with.lengthOf(0);
		});

		it('should retrieve all agendas', function() {
			return expect(agendaFactory.getAgendas()).to.eventually
				.be.an('array').with.lengthOf(4);
		});
	});

	describe('.chooseAgenda', function() {
		beforeEach(function() {
			sinon.stub(agendaFactory, 'getAgendas');			
		});

		afterEach(function() {
			agendaFactory.getAgendas.restore();
		});

		it('should return null if no agenda fits', function() {
			agendaFactory.getAgendas.returns([]);
			return expect(agendaFactory.chooseAgenda({})).to.eventually.be.null;
		});

		it('should return the agenda with the highest score', function() {
			let agendas = TEST_DATA.map(agenda => new Agenda(agenda.matches, null));
			agendaFactory.getAgendas.returns(agendas);			
			let ship = new Ship({
				ShipUpgradeInfo: {},
				level: 8,
				typeinfo: { type: 'Ship', species: 'Battleship', nation: 'USA' }
			}); // T8 BB
			return expect(agendaFactory.chooseAgenda(ship)).to.eventually.equal(agendas[3]);
		});
	});
});