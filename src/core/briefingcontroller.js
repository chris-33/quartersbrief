import BriefingBuilder from '../briefing/briefingbuilder.js';
import { EventEmitter } from 'events';
import { join } from 'path';
import { BASE_DIR } from '../init/paths.js';
import pug from 'pug';
import sass from 'sass';

export default class BriefingController {
	static BRIEFING_BUILDER_NO_AGENDA = new (class extends BriefingBuilder {
		build() {
			const briefing = new EventEmitter();
			briefing.id = 0;
			setImmediate(() => briefing.emit(BriefingBuilder.EVT_BRIEFING_START, briefing));

			briefing.html = pug.renderFile(join(BASE_DIR, 'src/briefing/no-agenda.pug'));
			briefing.css = sass.compile(join(BASE_DIR, 'src/briefing/message.scss')).css
			
			setImmediate(() => briefing.emit(BriefingBuilder.EVT_BRIEFING_FINISH, briefing));
			return briefing;
		}
	})();
	static BRIEFING_BUILDER_NO_BATTLE = new (class extends BriefingBuilder {
		build() {
			const briefing = new EventEmitter();
			briefing.id = 1;
			setImmediate(() => briefing.emit(BriefingBuilder.EVT_BRIEFING_START, briefing));

			briefing.html = pug.renderFile(join(BASE_DIR, 'src/briefing/no-battle.pug'));
			briefing.css = sass.compile(join(BASE_DIR, 'src/briefing/message.scss')).css
			
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