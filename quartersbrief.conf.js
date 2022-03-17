import log from 'loglevel';
import prefix from 'loglevel-plugin-prefix';
import envpaths from 'env-paths';
import path from 'path';
import chalk from 'chalk';
import _yargs from 'yargs';
import { hideBin } from 'yargs/helpers'
const yargs = _yargs(hideBin(process.argv));
import { existsSync, readFileSync } from 'fs';

// Assume production environment if nothing is specified
process.env.NODE_ENV = (process.env.NODE_ENV ?? 'production').toLowerCase();

// Use loglevel-plugin-prefix on the logger
prefix.reg(log);
prefix.apply(log, {
	template: '[%t] %l%n:',
	nameFormatter: (name) => name ? ` ${name}` : '',
	levelFormatter: (level) => {
		const colors = {
			error: chalk.red,
			warn: chalk.yellow,
			info: chalk.cyan,
			debug: (x) => x
		}
		return colors[level](level.toUpperCase());
	},
	timestampFormatter: date => date.toJSON()
});

// Make child loggers silent by default, unless they were explicitly listed with the --debug flag
const getChildLogger = log.getLogger;
log.getLogger = function(name,...args) {
	let result = getChildLogger.call(this,name,...args);
	result.disableAll();
	if ((Array.isArray(config.debug) && config.debug.includes(name)) 
		|| (typeof config.debug === 'string' && config.debug.toLowerCase() === 'all'))
		
		result.setLevel('debug');
	return result;
}.bind(log);

// get app name and version from package.json
// As per https://docs.npmjs.com/cli/v6/using-npm/scripts#packagejson-vars
const name = process.env.npm_package_name ?? 'quartersbrief';

// Get OS-specific paths for config, data, temp and cache.
// Use no suffix (default would be '-nodejs') because I think it's ugly and I foresee no name clashes.
// The documentation warns against this, though.
const standardpaths = envpaths(name, { suffix: '' });

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
		.option('debug', {
			coerce: function(value) {
				if (typeof value === 'boolean') 
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
			return JSON.parse(readFileSync(filename));
		}).default('config', 
			path.format({ 
				dir: standardpaths.config, 
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
		.argv
};

// Expand --listen shorthand into host and port
if (config.listen) {
	config.host = config.listen.split(':')[0];
	config.port = config.listen.split(':')[1];
}

// Set some values to OS-specific defaults, even though they are not technically intended to be configurable
config.datadir = standardpaths.data;
config.agendasdir = path.join(standardpaths.config, 'agendas');

// Set the loglevel, according to supplied options (--verbose and --debug)
log.setLevel(config.debug ? 'debug' : 'info');

export { config }