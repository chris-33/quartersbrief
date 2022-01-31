require('./quartersbrief.conf.js');
var fs = require('fs');
var gameObjectFactory = require('$/src/model/gameobjectfactory')
var Ship = require('$/src/model/ship');
var Modernization = require('$/src/model/modernization');



var data = JSON.parse(fs.readFileSync('data/GameParams.json'));
require('$/src/quartersbrief.assert')(data);

gameObjectFactory.setEverything(data);


const process = require('process');
const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout, prompt: 'Quarters Brief>' });
readline.prompt();
readline.on('line', function(input) {
	if (input.startsWith('stats ')) {
		input = input.substring(6);
		let ship = gameObjectFactory.createGameObject(input);
		ship.applyConfiguration('stock');
		console.log(`${ship.getName()}'s stats are: \n  
			rudder shift time: ${ship.getCurrentConfiguration().getRuddershift()}\n
			health: ${ship.getCurrentConfiguration().getHealth()}\n
			turning circle: ${ship.getCurrentConfiguration().getTurningCircle()}`);
	}
	if (input === 'exit') readline.close();
	readline.prompt();
});