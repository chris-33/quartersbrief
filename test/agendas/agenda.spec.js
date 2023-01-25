import Agenda from '../../src/agendas/agenda.js';
import Battle from '../../src/model/battle.js';
import Ship from '../../src/model/ship.js';
import sinon from 'sinon';
import { readFileSync } from 'fs';

describe.only('Agenda', function() {
	describe('constructor', function() {
		it('should turn a matchers section that is an object into an array', function() {
			const matcher = {};
			const agenda1 = new Agenda(matcher);
			const agenda2 = new Agenda([matcher]);

			expect(agenda1).to.deep.equal(agenda2);
		});

		it('should turn a missing matchers section into an array containing only an empty matcher object', function() {
			expect(new Agenda()).to.have.property('matchers').that.deep.equals([{}]);
		});
	});

	describe('.matches', function() {
		let ship;

		beforeEach(function() {
			ship = new Ship(JSON.parse(readFileSync('test/model/testdata/ship.json')));
		});

		it('should return an array of all matchers the ship matches', function() {
			const matchers = [
				{
					classes: [ ship.getClass() ],
					tiers: [ ship.getTier() ]					
				},
				{
					ships: [ ship.getName() ]
				}
			];
			const agenda = new Agenda(matchers);

			expect(agenda.matches(ship)).to.have.members(matchers);
		});
		it('should return null if the ship matches none of the matchers', function() {
			const matchers = [{
				tiers: [ 0 ]
			}];
			const agenda = new Agenda(matchers);

			expect(agenda.matches(ship)).to.be.null;
		});
	});

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
