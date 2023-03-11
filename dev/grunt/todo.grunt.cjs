module.exports = {
	src: [ 'src/**/*.js', 'res/www/js/**/*.js', 'test/**/*.js' ],
	options: {
		marks: [
			{
				name: 'Bug',
				pattern: /(?:@bug|@fixme)/i,
				color: 'red'
			},
			{ 
				name: 'ToDo',
				pattern: /@todo/i,
				color: 'yellow'
			},
			{ 
				name: 'Reverse engineer',
				pattern: /@reveng/i,
				color: 'magenta'
			},
			{
				name: 'Note',
				pattern: /@note/i,
				color: 'cyan'
			}

		]
	}
}