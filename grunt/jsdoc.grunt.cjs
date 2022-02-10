module.exports = {
	dist : {
		src: ['src/**/*.js','obj_formats/**/*'],
		dest: 'docs',
		options: {
			verbose: true,
			template : "node_modules/ink-docstrap/template",
			configure : "node_modules/ink-docstrap/template/jsdoc.conf.json"
		}
	}
}