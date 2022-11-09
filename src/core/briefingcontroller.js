import BriefingBuilder from '../briefing/briefingbuilder.js';
import { EventEmitter } from 'events';
import pug from 'pug';
import sass from 'sass';

export default class BriefingController {
	static BRIEFING_BUILDER_NO_AGENDA = new (class extends BriefingBuilder {
		build() {
			const briefing = new EventEmitter();
			setImmediate(() => briefing.emit(BriefingBuilder.EVT_BRIEFING_START));

			briefing.html = pug.renderFile('src/briefing/no-agenda.pug');
			briefing.css = sass.compile('src/briefing/message.scss').css
			
			setImmediate(() => briefing.emit(BriefingBuilder.EVT_BRIEFING_FINISH, briefing));
			return briefing;
		}
	})();
	static BRIEFING_BUILDER_NO_BATTLE = new (class extends BriefingBuilder {
		build() {
			const briefing = new EventEmitter();
			setImmediate(() => briefing.emit(BriefingBuilder.EVT_BRIEFING_START));

			briefing.html = pug.renderFile('src/briefing/no-battle.pug');
			briefing.css = sass.compile('src/briefing/message.scss').css
			
			setImmediate(() => briefing.emit(BriefingBuilder.EVT_BRIEFING_FINISH, briefing));
			return briefing;
		}
	})();

	constructor(battleDataReader, briefingBuilder, agendaController) {
		this.battleDataReader = battleDataReader;
		this.briefingBuilder = briefingBuilder;
		this.agendaController = agendaController;
	}

	async createBriefing() {
		const battle = await this.battleDataReader.read();
		if (!battle) {
			return BriefingController.BRIEFING_BUILDER_NO_BATTLE.build();
		}
		
		const agenda = await this.agendaController.choose(battle);
		if (!agenda) 
			return BriefingController.BRIEFING_BUILDER_NO_AGENDA.build();

		return this.briefingBuilder.build(battle, agenda);
	}
}