import AgendaStore from '../../src/agendas/agendastore.js';
import Agenda from '../../src/agendas/agenda.js';
import mockfs from 'mock-fs';
import { readFileSync } from 'fs';
import TOML from '@iarna/toml';
import YAML from 'yaml';

describe('AgendaStore', function() {
	let TEST_DATA;
	let agendaStore;

	before(function() {
		// "before" hooks run before beforeEach hooks, so this will still read from the real filesystem
		TEST_DATA = JSON.parse(readFileSync('test/agendas/testdata/agendas.json'));
	});

	beforeEach(function() {
		agendaStore = new AgendaStore('agendas');		

		let files = {};
		// Create fake files from TEST_DATA and "store" them with mock-fs 
		// for getAgendas() to read
		for (let i = 0; i < TEST_DATA.length; i++) 
			files[`agenda${i}.toml`] = TOML.stringify(TEST_DATA[i]);		
		// Create a mock directory "agendas" that contains the files
		mockfs({ 'agendas': files });
	});

	afterEach(function() {
		mockfs.restore();
	});

	describe('.getAgendas', function() {
		it('should ignore files whose extension is not .yaml, .yml, .json or .toml', function() {
			mockfs({ agendas: {
				'somethingelse.txt': ''
			}});

			return expect(agendaStore.getAgendas()).to.eventually.be.empty;
		});

		it('should be able to parse TOML, YAML and JSON', async function() {
			const agenda = TEST_DATA[0];
			const files = {
				'agenda.yaml': YAML.stringify(agenda),
				'agenda.yml': YAML.stringify(agenda),
				'agenda.toml': TOML.stringify(agenda),
				'agenda.json': JSON.stringify(agenda)
			};
			mockfs({
				agendas: files
			});
			const expected = new Agenda(agenda.matches, agenda.topics);

			const result = await agendaStore.getAgendas();
			expect(result).to.be.an('array').with.lengthOf(4);
			result.forEach(agenda => expect(agenda).to.deep.equal(expected));
		});

		it('should throw if the agendas path does not exist', function() {
			agendaStore = new AgendaStore('doesnotexist');
			return expect(agendaStore.getAgendas()).to.eventually.be.rejected;
		});

		it('should return an empty array if there are no agenda files', function() {
			mockfs({ 'emptydir': {} });
			agendaStore = new AgendaStore('emptydir');
			return expect(agendaStore.getAgendas()).to.eventually.be.an('array').with.lengthOf(0);
		});

		it('should retrieve all agendas', function() {
			return expect(agendaStore.getAgendas()).to.eventually
				.be.an('array').with.lengthOf(4);
		});
	});

});