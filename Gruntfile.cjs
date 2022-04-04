module.exports = function(grunt) {
	let config = require('./grunt/index.cjs');	
	config.pkg = grunt.file.readJSON('package.json')
	grunt.initConfig(config);
	
	grunt.loadNpmTasks('grunt-jsdoc');
	grunt.loadNpmTasks('grunt-eslint');
	grunt.loadNpmTasks('grunt-todo');
	grunt.loadNpmTasks('grunt-mocha-test')
	grunt.loadNpmTasks('grunt-bump');
	grunt.loadNpmTasks('grunt-debian-package')
}