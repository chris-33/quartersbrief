import log from 'loglevel';
import fse from 'fs-extra';
import { paths } from './config.js';

// Create default configuration if the config directory does not exist
export default async function createconfig() {
	if (!(await fse.pathExists(paths.config))) {
		log.info(`Could not find config directory at ${paths.config}, creating default config`);
		await fse.mkdirp(paths.config)
		await fse.copy('res/defaultconfig/', paths.config);
	}	
}

