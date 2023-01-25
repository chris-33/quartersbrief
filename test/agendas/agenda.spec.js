import Agenda from '../../src/agendas/agenda.js';
import Battle from '../../src/model/battle.js';
import Ship from '../../src/model/ship.js';
import sinon from 'sinon';

describe('Agenda', function() {
	describe('.getTopicNames', function() {
		it('should return the names of all topics of the agenda', function() {
			expect(new Agenda(null, {
				topic1: {},
				topic2: {}
			}).getTopicNames()).to.be.an('array').with.members([ 'topic1', 'topic2' ]);
		});

		it('should have topic data for all returned topic names', function() {
			let agenda = new Agenda(null, {
				topic1: { prop: 'prop' },
				topic2: { prop: 'prop' }
			});
			agenda.getTopicNames().forEach(topic => expect(agenda.topics[topic]).to.have.property('prop'));
		});
	});
});
