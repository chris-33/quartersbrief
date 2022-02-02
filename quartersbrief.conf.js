import log from 'loglevel';
import prefix from 'loglevel-plugin-prefix';

/*
 * Do some configuration stuff, such as setting up the logger etc.
 */

function init() {
	prefix.reg(log);
	prefix.apply(log);
	log.setLevel('warn');
}

export { init }