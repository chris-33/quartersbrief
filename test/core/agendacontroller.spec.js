import AgendaController from '../../src/core/agendacontroller.js';
import AgendaStore from '../../src/agendas/agendastore.js';
import sinon from 'sinon';

describe('AgendaController', function() {
	let controller;
	let source1, source2;
	let chooser;

	beforeEach(function() {
		source1 = new AgendaStore();
		source2 = new AgendaStore();

		sinon.stub(source1, 'getAgendas');
		sinon.stub(source2, 'getAgendas');
	});

	beforeEach(function() {
		chooser = {
			choose: sinon.stub()
		}
	});

	beforeEach(function() {
		controller = new AgendaController([source1, source2], chooser);
	});

	describe('.choose', function() {
		it('should call choose() on the chooser with the battle', async function() {
			const battle = {};
			const agenda1 = {};
			const agenda2 = {};
			source1.getAgendas.resolves([ agenda1 ]);
			source2.getAgendas.resolves([ agenda2 ]);

			await controller.choose(battle);
			expect(chooser.choose).to.have.been.calledWith(battle, sinon.match([ agenda1, agenda2 ]));
		});
	});
});