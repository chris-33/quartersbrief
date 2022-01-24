/*
 * Do some configuration stuff, such as setting up the logger etc.
 */
var log = require('loglevel');
var prefix = require('loglevel-plugin-prefix');
prefix.reg(log);
prefix.apply(log);
log.setLevel('debug');