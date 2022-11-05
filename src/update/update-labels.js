import executeSteps, { each } from './infra/execute-steps.js';
import { readFile, writeJSON } from './infra/steps.js';
import gettext from 'gettext-parser';

export default async function updateLabels(wows, dest, buildno) {
	return executeSteps([
		// Read the file as a buffer, because that is how gettext-parser expects it
		readFile({ encoding: null}, `${wows}/bin/${buildno}/res/texts/en/LC_MESSAGES/global.mo`),
		// Parse the MO file, drop headers and use default context
		data => gettext.mo.parse(data).translations[''], 
		// Right now, every translation entry is of the form
		// IDS_FOO: {
		//   msgid: IDS_FOO,
		//   msgstr: [ 'BAR'] 
		// }
		// 
		// We need it as IDS_FOO: 'BAR'
		each(entry => entry.msgstr[0]),
		writeJSON(`${dest}/global-en.json`)
	])
}