import envpaths from 'env-paths';
import path from 'path';
import _yargs from 'yargs';
import { hideBin } from 'yargs/helpers'
const yargs = _yargs(hideBin(process.argv));
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';
import log from 'loglevel';

// Assume production environment if nothing is specified
process.env.NODE_ENV = (process.env.NODE_ENV ?? 'production').toLowerCase();

// get app name and version from package.json
// As per https://docs.npmjs.com/cli/v6/using-npm/scripts#packagejson-vars
const name = process.env.npm_package_name ?? 'quartersbrief';

// Get OS-specific paths for config, data, temp and cache.
// Use no suffix (default would be '-nodejs') because I think it's ugly and I foresee no name clashes.
// The documentation warns against this, though.
const paths = {
	...envpaths(name, { suffix: '' }),
	base: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../')
};

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
		.option('wowsdir', {
			alias: 'd',
			type: 'string',
			normalize: true,
			demandOption: 'Either pass it using --wowsdir or set it in your quartersbrief.conf. Exiting.',
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
		.config()
		.default('config', 
			path.format({ 
				dir: paths.config, 
				name: { development: 'quartersbrief.dev', production: 'quartersbrief' }[process.env.NODE_ENV] ?? `quartersbrief.${process.env.NODE_ENV}`,
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

config.agendasdir = path.join(paths.config, 'agendas');

export { config as default, paths };