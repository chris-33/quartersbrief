import log from 'loglevel';
import prefix from 'loglevel-plugin-prefix';
import chalk from 'chalk';
import config from './config.js';

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
	timestampFormatter: date => `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2,'0')}.${date.getMilliseconds().toString().padStart(3,'0')}`
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

// Set the loglevel, according to supplied options (--verbose and --debug)
log.setLevel(config.debug ? 'debug' : 'info');