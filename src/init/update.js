import config from './config.js';
import { DATA_DIR } from './paths.js';
import Updater from '../update/updater.js';
import updateLabels from '../update/update-labels.js';
import updateGameParams from '../update/update-gameparams.js';
import updateArmor from '../update/update-armor.js';

export default function update() {
	const updater = new Updater(config.wowsdir, DATA_DIR);
	updater.register(updateLabels)
	updater.register(updateGameParams);
	updater.register(updateArmor);
	return updater.update(config);
}