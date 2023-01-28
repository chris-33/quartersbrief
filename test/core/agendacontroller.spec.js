import AgendaController from '../../src/core/agendacontroller.js';
import sinon from 'sinon';
import esmock from 'esmock';

describe('AgendaController', function() {
	
	describe('.choose', function() {
		let chooser;
		let controller;
		const sources = [
			[], []
		];

		beforeEach(function() {
			chooser = {
				choose: sinon.stub()
			}
		});

		beforeEach(async function() {
			controller = await AgendaController.create([], chooser);
			controller.sources = sources;
		});

		it('should call choose() on the chooser with the battle for each source', function() {
			const battle = {};

			controller.choose(battle);

			sources.forEach(source => expect(chooser.choose).to.have.been.calledWith(battle, source));
		});

		it('should choose from each source in turn, and only if the previous source had no matches', function() {
			const battle = {};
			const agenda = {};

			// Part one of this test: If a source returned a matching agenda, the controller should stop looking
			chooser.choose.returns(agenda);
			let result = controller.choose(battle);
			expect(chooser.choose).to.have.been.calledOnce;
			expect(result).to.equal(agenda);

			// Reset the stub
			chooser.choose.reset();

			// The second part of this test: If the source did not return a matching agenda, the controller should try the next source
			chooser.choose.onFirstCall().returns(null);
			chooser.choose.onSecondCall().returns(agenda);
			result = controller.choose(battle);
			expect(chooser.choose).to.have.been.calledTwice;
			expect(result).to.equal(agenda);
		});
	});

	describe('AgendaController.create', function() {
		let compiler;
		let AgendaController;

		beforeEach(async function() {
			// The reason for this rather roundabout setup:
			// ES modules cannot be spied on directly, i.e. doing sinon.spy() directly on the dynamic import will cause an error to that effect.
			// What's worse, spying on compiler's methods AFTER calling esmock has no effect.
			// So instead, we will set up a fake compiler module where all functions are already stubbed and make them call through by default
			const _compiler = await import('../../src/agendas/compiler.js');
			compiler = {};
			for (let method in _compiler) 
				compiler[method] = sinon.stub().callsFake(_compiler[method]);

			AgendaController = (await esmock.strict('../../src/core/agendacontroller.js', {
				'../../src/agendas/compiler.js': compiler
			})).default;
		});

		it('should return an AgendaController', async function() {
			return expect(AgendaController.create()).to.eventually.be.an.instanceof(AgendaController);
		});

		it('should load from all sources', async function() {
			const sources = [ '/source1', '/source2' ];
			compiler.load.resolves([]);

			await AgendaController.create(sources);
			
			sources.forEach(source => expect(compiler.load).to.have.been.calledWith(source));				
		});

		it('should link all agendas, even across sources', async function() {
			const sources = [ '/source1', '/source2' ];
			const agendas = new Array(4).fill({});

			compiler.load.withArgs(sources[0]).resolves(agendas.slice(0, 2));
			compiler.load.withArgs(sources[1]).resolves(agendas.slice(2));

			await AgendaController.create(sources);

			agendas.forEach(agenda => expect(compiler.link).to.have.been.calledWith(agenda, agendas));
		});

		it('should compile all agendas', async function() {
			const sources = [ '/source1', '/source2' ];
			const agendas = new Array(4).fill({});

			compiler.load.withArgs(sources[0]).resolves(agendas.slice(0, 2));
			compiler.load.withArgs(sources[1]).resolves(agendas.slice(2));

			await AgendaController.create(sources);

			agendas.forEach(agenda => expect(compiler.compile).to.have.been.calledWith(agenda));
		});
	});
});