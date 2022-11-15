const fs = require('fs');
const path = require('path');
const grunt = require('grunt');

const config = {};

fs
	.readdirSync(__dirname)
	.filter(function(file) {
		return file.indexOf('.grunt.cjs') !== -1;
	})
	.forEach(function(file) {
		const modulename = path.basename(file, '.grunt.cjs');
		try {
			config[modulename] = require(`./${file}`);
			grunt.log.ok(`Loaded task ${modulename}`);
		} catch (err) {
			grunt.log.error(`Loading task ${modulename} failed: ${err.message}`);
		}
		
	});

module.exports = config;