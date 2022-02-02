module.exports = function(grunt) {
	var config = require('./grunt/index.cjs');	
	config.pkg = grunt.file.readJSON('package.json')
	grunt.initConfig(config);
	
	grunt.loadNpmTasks('grunt-jsdoc');
	grunt.loadNpmTasks('grunt-eslint')
}