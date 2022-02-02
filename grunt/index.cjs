const fs = require('fs');
const path = require('path');

const config = {};

fs
	.readdirSync(__dirname)
	.filter(function(file) {
		return file.indexOf('.grunt.cjs') !== -1;
	})
	.forEach(function(file) {
		const modulename = path.basename(file, '.grunt.cjs');
		console.log('Loading task ' + modulename + ' from ' + file);
		
		config[modulename] = require('./' + file);
	});

module.exports = config;