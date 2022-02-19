import { SpecificityStrategy } from '../../src/briefing/specificitystrategy.js';
import { Agenda } from '../../src/briefing/agenda.js';
import { Battle } from '../../src/model/battle.js';
import { readFileSync } from 'fs';
import sinon from 'sinon';

describe('SpecificityStrategy', function() {
	let TEST_DATA;
	let strategy;

	before(function() {
		TEST_DATA = JSON.parse(readFileSync('test/briefing/testdata/agendas.json'));
		strategy = new SpecificityStrategy();
	});

	describe('.chooseAgenda', function() {
		it('should return null if there are no agendas', function() {			
			expect(strategy.chooseAgenda({}, [])).to.be.null;
		});

		it('should return null if no agendas fit', function() {
			let agendas = TEST_DATA.map(agenda => new Agenda(agenda.matches, null));
			agendas.forEach(agenda => sinon.stub(agenda, 'matches').returns(false));
			try {
				expect(strategy.chooseAgenda({}, [])).to.be.null;
			} finally {
				agendas.forEach(agenda => agenda.matches.restore());
			}
		});

		it('should return the agenda with the highest score', function() {
			let agendas = TEST_DATA.map(agenda => new Agenda(agenda.matches, null));
			let battle = new Battle();
			agendas.forEach(agenda => sinon.stub(agenda, 'matches').returns(true));
			try {				
				expect(strategy.chooseAgenda(battle, agendas)).to.equal(agendas[3]);
			} finally {
				agendas.forEach(agenda => agenda.matches.restore());
			}
		});
	});
});