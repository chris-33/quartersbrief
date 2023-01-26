import Agenda from '../../src/agendas/agenda.js';
import Ship from '../../src/model/ship.js';
import { readFileSync } from 'fs';

describe('Agenda', function() {
	describe('constructor', function() {
		it('should turn a matchers section that is an object into an array', function() {
			const matcher = {};
			const agenda1 = new Agenda(matcher);
			const agenda2 = new Agenda([matcher]);

			expect(agenda1).to.deep.equal(agenda2);
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

	describe('extend', function() {
		it('should use the extended agenda\'s matchers if the extending agenda does not have any', function() {
			const extending = new Agenda();
			const extended = new Agenda([
				{ tiers: [ 8 ] }
			]);

			const result = Agenda.extend(extending, extended);

			expect(result.matchers).to.deep.equal(extended.matchers);
		});

		it('should use the extending agenda\'s matchers if defined', function() {
			const extending = new Agenda([
				{ tiers: [ 8 ] }
			]);
			const extended = new Agenda([
				{ classes: [ 'Destroyer' ] }
			]);
			
			const result = Agenda.extend(extending, extended);

			expect(result.matchers).to.deep.equal(extending.matchers);
		});

		it('should add topics from the extended agenda if not present in the extending agenda', function() {
			const topic = { prop: 'val' };
			const extending = new Agenda(null, {});
			const extended = new Agenda(null, { topic });

			const result = Agenda.extend(extending, extended);

			expect(result.topics).to.have.property('topic').that.deep.equals(topic);
		});

		it('should keep topics from the extending agenda even if not present in the extended agenda', function() {
			const topic = { prop: 'val' };
			const extending = new Agenda(null, { topic });
			const extended = new Agenda(null, {});

			const result = Agenda.extend(extending, extended);

			expect(result.topics).to.have.property('topic').that.deep.equals(topic);
		});

		it('should add topic properties from the extended agenda', function() {
			const extending = new Agenda(null, { 
				topic: { prop1: 'val1' } 
			});
			const extended = new Agenda(null, { 
				topic: { prop2: 'val2' } 
			});

			const result = Agenda.extend(extending, extended);

			expect(result.topics).to.have.property('topic');
			expect(result.topics.topic).to.have.property('prop1').that.equals('val1');
			expect(result.topics.topic).to.have.property('prop2').that.equals('val2');
		});

		it('should not overwrite topic properties already defined by the extending agenda', function() {
			const extending = new Agenda(null, { 
				topic: { prop: 'val1' } 
			});
			const extended = new Agenda(null, { 
				topic: { prop: 'val2' } 
			});

			const result = Agenda.extend(extending, extended);

			expect(result.topics).to.have.property('topic');
			expect(result.topics.topic).to.have.property('prop').that.equals('val1');			
		});
	});
});
