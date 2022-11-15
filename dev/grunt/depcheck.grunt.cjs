module.exports = {
	options: {
		failOnMissingDeps: true,
		ignoreMatches: [
			'grunt*',
			'eslint*',
			'mocha'
		]
	},
	default: {
		files: {
			src: '.'
		}
	}
}