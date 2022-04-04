module.exports = {
	options: {
		npm: false,
		tagName: 'v<%= version %>',
		tagMessage: 'v<%= version %>',
		github: {
			repo: 'BadIdeaException/quartersbrief',
			accessTokenVar: 'GITHUB_ACCESS_TOKEN'
		}
	}
}