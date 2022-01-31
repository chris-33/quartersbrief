/*
 * Do some configuration stuff, such as setting up the logger etc.
 */
const log = require('loglevel');
const prefix = require('loglevel-plugin-prefix');
prefix.reg(log);
prefix.apply(log);
log.setLevel('warn');