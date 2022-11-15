const grunt = require('grunt');
const combine = require('regex-combine-and').default;

// This only defines extra settings that need to be passed as command-line arguments to mocha by the grunt task.
// The basic default config lives in ../.mocharc.cjs
module.exports = {
	options: {
		grep: grunt.option('grep'),
		flags: []
	},
	unit: {
		options: {
			// Any test that does not have an @tag
			grep: grunt.option('grep') ? combine([/^[^@]*$/, new RegExp(grunt.option('grep'))]) : /^[^@]*$/
		}
	},
	integration: {
		options: {
			// Any test that has an @integration tag
			grep: grunt.option('grep') ? combine([/@integration/, new RegExp(grunt.option('grep'))]) : '@integration',
		},
	}
}

if (grunt.option('inspect-local')) {
	module.exports.options.flags.push('inspect');
}