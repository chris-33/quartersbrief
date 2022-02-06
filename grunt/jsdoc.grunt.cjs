module.exports = {
	dist : {
		src: ['src/**/*.js'],
		dest: 'docs',
		options: {
			verbose: true,
			template : "node_modules/ink-docstrap/template",
			configure : "node_modules/ink-docstrap/template/jsdoc.conf.json"
		}
	}
}