import AgendaController from '../../src/core/agendacontroller.js';
import SpecificityChooser from '../../src/agendas/specificitychooser.js';
import Agenda from '../../src/agendas/agenda.js';
import Battle from '../../src/model/battle.js';
import GameObjectFactory from '../../src/model/gameobjectfactory.js';
import sinon from 'sinon';
import mockfs from 'mock-fs';

describe('AgendaController @integration', function() {
	after(function() {
		mockfs.restore();
	});
	
	describe('AgendaController.create', function() {
		const extended = {
			name: 'extended',
			matches: [
				{ cond: 'value' }
			],
			topics: {
				topic1: {}
			}
		};
		const extending = {
			name: 'extending',
			extends: 'extended',
			matches: [
				{ othercond: 'value' }
			],
			topics: {
				topic2: {}
			}
		};

		it('should load, link and compile all agendas from all sources', async function() {
			const source1 = '/source1';
			const source2 = '/source2';
			mockfs({
				[source1]: { 
					'extending.json': JSON.stringify(extending)
				},
				[source2]: { 
					'extended.json': JSON.stringify(extended)
				}
			});
			const controller = await AgendaController.create([ source1, source2 ]);

			const expected = {
				name: extending.name,
				matches: extending.matches,
				topics: Object.assign({}, extending.topics, extended.topics)
			}
			expect(controller.sources).to.be.an('array').with.lengthOf(2);
			expect(controller.sources[0]).to.have.deep.members([ Agenda.from(expected) ]);
			expect(controller.sources[1]).to.have.deep.members([ Agenda.from(extended) ]);
		});
	});

	describe('.choose', function() {
		const MOCK_GAME_OBJECT = {
			getNation: function() { return 'nation' },
			getClass: function() { return 'class' }
		};
		const MOCK_GAME_OBJECT_FACTORY = new GameObjectFactory();
		const MOCK_BATTLE = new Battle();

		before(function() {
			sinon.stub(MOCK_GAME_OBJECT_FACTORY, 'createGameObject').returns(MOCK_GAME_OBJECT);
			sinon.stub(MOCK_BATTLE, 'getPlayer').returns({})
		});

		const lessSpecific = {
			matches: [
				{ nations: 'nation'}
			]
		};
		const moreSpecific = {
			matches: [
				{ nations: [ 'nation' ], classes: [ 'class' ] }
			]
		};
				
		it('should return the most specific agenda from the first source that has a matching one', async function() {		
			const chooser = new SpecificityChooser(MOCK_GAME_OBJECT_FACTORY);

			const userspace = '/user';
			const defaultspace = '/default';
			mockfs({
				[userspace]: {
					'less specific.json': JSON.stringify(lessSpecific)
				},
				[defaultspace]: {
					'more specific.json': JSON.stringify(moreSpecific)
				}
			});
			const controller = await AgendaController.create([ userspace, defaultspace ], chooser);

			const agenda = controller.choose(MOCK_BATTLE);

			// Should have chosen the less specific agenda, because it comes from a source with higher precedence:
			expect(agenda).to.deep.equal(Agenda.from(lessSpecific));
		});
	});


});