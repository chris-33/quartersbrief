var fs = require('fs');
var path = require('path');

var config = {};

fs
	.readdirSync(__dirname)
	.filter(function(file) {
		return file.indexOf('.grunt.js') !== -1;
	})
	.forEach(function(file) {
		var modulename = path.basename(file, '.grunt.js');
		console.log('Loading task ' + modulename + ' from ' + file);
		
		config[modulename] = require('./' + file);
	});

module.exports = config;