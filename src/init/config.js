import path from 'path';
import _yargs from 'yargs';
import { hideBin } from 'yargs/helpers'
const yargs = _yargs(hideBin(process.argv));
import { CONFIG_USER_DIR } from './paths.js';
import log from 'loglevel';
import { existsSync, readFileSync } from 'fs';

// Assume production environment if nothing is specified
process.env.NODE_ENV = (process.env.NODE_ENV ?? 'production').toLowerCase();

// get app name and version from package.json
// As per https://docs.npmjs.com/cli/v6/using-npm/scripts#packagejson-vars
const name = process.env.npm_package_name ?? 'quartersbrief';

const config = {
	// Defaults:
	host: '127.0.0.1',
	port: 10000,

	...yargs
		.scriptName(name)
		.option('skip-invariants', {
			alias: 's',
			type: 'boolean',
			description: 'Do not check fundamental assumptions at application start.',
		})
		.option('scroll-snap', {
			type: 'boolean',
			description: 'Snap to nearest topic when scrolling.'
		})
		.option('wowsdir', {
			alias: 'd',
			type: 'string',
			normalize: true,
			description: 'The base directory of World of Warship. This is the directory that WorldOfWarships.exe is in.'
		})
		.option('host', {
			alias: 'h',
			type: 'string',
			description: 'The IP addresses to accept connections from. You can use this to display the briefing on a secondary device, e.g. a tablet. Cannot be used together with --listen. Default: 127.0.0.1',
			conflicts: 'listen',
		})
		.option('port', {
			alias: 'p',
			type: 'number',
			description: 'The port to accept connections on. Cannot be used together with --listen. Default: 10000',
			conflicts: 'listen',
		})
		.option('listen', {
			type: 'string',
			description: 'Specify host and port for connections. Usage: --listen host:port. Cannot be used together with --host and --port',
			conflicts: [ 'host', 'port' ],
		})
		.option('api-key', {
			type: 'string',
			description: 'A Wargaming-issued application_id. This is required for topics that access the online Wargaming API.'
		})
		.option('realm', {
			type: 'string',
			description: 'The realm (server) you will be playing on. This is required for topics that access the online Wargaming API.'
		})
		.option('update-policy', {
			type: 'string',
			choices: [ 'force', 'auto', 'prohibit' ],
			default: 'auto',
			description: 'Controls how updates to the game files are handled. Explanation of values:\n\tforce: perform extraction of game data regardless of game version\n\tauto: automatically check the game version, update if necessary\n\tprohibit: do not check the game version, do not update'
		})
		.option('debug', {
			coerce: function(value) {
				if (typeof value === 'undefined')
					return null;
				else if (typeof value === 'boolean') 
					value = value ? [] : null;
				else if (value !== 'all')
					value = value.split(',');
				return value;
			},
			description: 'Output debug information. It can also be used in an alternate form --debug <dedicatedlogs>, where <dedicatedlogs> is a comma-separated list of dedicated loggers to switch on. Use --debug all to turn on all dedicated loggers. Available dedicated loggers are: GameObjectFactory, assertInvariants'
		})
		.config('config', function loadConfig(filename) {
			// Do not expect the default config file to exist. If it doesn't, we will treat it as if it was empty.
			// Config files passed explicitly using --config are still expected to exist though, and it is an
			// error if they don't.
			if (!existsSync(filename) && !process.argv.includes('--config')) {
				log.warn(`Could not find default config file ${filename}.`)
				return {};
			}
			let config;
			try {
				config = readFileSync(filename, 'utf8');
				// config file may contain backslashes, e.g. in Windows paths.
				// readFileSync does not escape these, so we need to manually do it.
				config = config.replaceAll(/\\/g, '\\\\');
				config = JSON.parse(config);
			} catch (err) {
				log.error(`Error reading config file ${filename}: ${err}. Ignoring config file.`);
				config = {};
			}
			return config;
		})
		.default('config', path.format({ 
			dir: CONFIG_USER_DIR, 
			name: 'quartersbrief',
			ext: '.json' 
		}))
		.help()
		.version()
		.wrap(yargs.terminalWidth())
		.fail(function(msg) {
			log.error(msg);
			process.exit(1);
		})
		.updateStrings({
			'default': '',
		})
		.argv
};

// Expand --listen shorthand into host and port
if (config.listen) {
	config.host = config.listen.split(':')[0];
	config.port = config.listen.split(':')[1];
}

export default config;