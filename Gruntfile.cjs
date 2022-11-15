module.exports = function(grunt) {
	let config = require('./dev/grunt/index.cjs');	
	config.pkg = grunt.file.readJSON('package.json')
	grunt.initConfig(config);
	
	require('load-grunt-tasks')(grunt);

	grunt.registerTask('test', function(target) {		
		grunt.task.run(`mochacli${target ? `:${target}` : ''}`);
	});

	grunt.renameTask('bump', '_bump');
	grunt.registerTask('bump', ['eslint', 'test', '_bump']);
}