import log from 'loglevel';
import prefix from 'loglevel-plugin-prefix';
import nconf from 'nconf';
import envpaths from 'env-paths';
import path from 'path';

// Assume production environment if nothing is specified
process.env.NODE_ENV = (process.env.NODE_ENV ?? 'production').toLowerCase();

// Use loglevel-plugin-prefix on the logger
prefix.reg(log);
prefix.apply(log);

// get app name and version from package.json
// As per https://docs.npmjs.com/cli/v6/using-npm/scripts#packagejson-vars
const name = process.env.npm_package_name ?? 'quartersbrief';

// Get OS-specific paths for config, data, temp and cache.
// Use no suffix (default would be '-nodejs') because I think it's ugly and I foresee no name clashes.
// The documentation warns against this, though.
const standardpaths = envpaths(name, { suffix: '' });

// Some default values for production & development
const ENV_DEFAULTS = {
	production: {
	},
	development: {
		wowsdir: '/opt/World of Warships',
		debug: true
	},
	common: {
		host: '127.0.0.1',
		port: 10000,
		agendas: path.join(standardpaths.data, 'agendas'),
		skipInvariants: false,
		verbose: false,
		debug: false,
		// Set some values to OS-specific defaults, even though they are not technically intended to be configurable
		datadir: standardpaths.data,
		agendasdir: path.join(standardpaths.config, 'agendas')
	}
}
// Construct a defaults object using spread syntax based on ENV_DEFAULTS.common, with properties overwritten as per the current NODE_ENV
const DEFAULTS = { ...ENV_DEFAULTS.common, ...ENV_DEFAULTS[process.env.NODE_ENV] };

// Load config from 
// 1. command-line options (highest priority)
// 2. environment variables
// 3. quartersbrief.json in config dir
// 4. defaults (lowest priority)
const config = nconf
				.argv({
					'skip-invariants': {
						alias: 's',
						parseValues: true,
						description: 'Do not check fundamental assumptions at application start.',
						transform: obj => ({ key: 'skipInvariants', value: obj.value })
					},
					'host': {
						alias: 'h',
						description: 'The IP addresses to accept connections from. You can use this to display the briefing on a secondary device, e.g. a tablet',
					},
					'port': {
						alias: 'p',
						parseValues: true,
						description: 'The port on which to accept connections.',
					},
					'wowsdir': {
						description: 'The base directory of World of Warship. This is the directory that WorldOfWarships.exe is in.'
					},
					'verbose': {
						alias: 'v',
						description: 'Show more output.'
					},
					'debug': {
						description: 'Show even more output'
					}
				})
				.env({ lowerCase: true })
				.file(path.join(standardpaths.config, `${name}.json`))
				.defaults(DEFAULTS);

// Set the loglevel, according to supplied options (--verbose and --debug)
if (config.get('debug')) log.setLevel('debug')
else if (config.get('verbose')) log.setLevel('info')
else log.setLevel('warn');

export { config }