import { init } from '$/quartersbrief.conf.js';
import { readFileSync } from 'fs';
import { gameObjectFactory } from '$/src/model/gameobjectfactory.js';
import { Ship } from '$/src/model/ship.js';
import { Modernization } from '$/src/model/modernization.js';
import { assertInvariants } from '$/src/quartersbrief.assert.js';
import process from 'process';
import node_readline from 'readline';




var data = JSON.parse(readFileSync('data/GameParams.json'));
assertInvariants(data);

gameObjectFactory.setEverything(data);

const readline = node_readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'Quarters Brief>' });
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