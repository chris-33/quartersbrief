import BriefingController from '../../src/core/briefingcontroller.js';
import sinon from 'sinon';

describe('BriefingController', function() {
	let battleDataReader,
		agendaController,
		briefingBuilder;

	let briefingController;

	const battle = {};
	const agenda = {};
	const briefing = {};

	beforeEach(function() {
		battleDataReader = {
			read: sinon.stub().resolves(battle)			
		},
		agendaController = {
			choose: sinon.stub().resolves(agenda)
		}
		briefingBuilder = {
			build: sinon.stub().returns(briefing)
		}
	});

	beforeEach(function() {
		briefingController = new BriefingController(battleDataReader, briefingBuilder, agendaController)
	});

	describe('.createBriefing', function() {
		it('should call read() on its battleDataReader', async function() {
			await briefingController.createBriefing();
			expect(battleDataReader.read).to.have.been.called;
		});

		it('should call choose() with the battle on its agendaController', async function() {
			await briefingController.createBriefing();
			expect(agendaController.choose).to.have.been.calledWith(battle);
		});

		it('should call build with the battle and the agenda on its briefingBuilder, and return the result', async function() {		
			const result = await briefingController.createBriefing();
			expect(briefingBuilder.build).to.have.been.calledWith(battle, agenda);
			expect(result).to.equal(briefing);
		});

		it('should call build on BRIEFING_BUILDER_NO_BATTLE if battleDataReader.read() returns null', async function() {
			battleDataReader.read.resolves(null);
			sinon.spy(BriefingController.BRIEFING_BUILDER_NO_BATTLE, 'build');
			try {
				await briefingController.createBriefing();
				expect(briefingBuilder.build).to.not.have.been.called;
				expect(BriefingController.BRIEFING_BUILDER_NO_BATTLE.build).to.have.been.called;
			} finally {
				BriefingController.BRIEFING_BUILDER_NO_BATTLE.build.restore();
			}
		});

		it('should call build on BRIEFING_BUILDER_NO_AGENDA if agendaController.choose() returns null', async function() {
			agendaController.choose.resolves(null);
			sinon.spy(BriefingController.BRIEFING_BUILDER_NO_AGENDA, 'build');
			try {
				await briefingController.createBriefing();
				expect(briefingBuilder.build).to.not.have.been.called;
				expect(BriefingController.BRIEFING_BUILDER_NO_AGENDA.build).to.have.been.called;
			} finally {
				BriefingController.BRIEFING_BUILDER_NO_AGENDA.build.restore();
			}
		});
	});
});