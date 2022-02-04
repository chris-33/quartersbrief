import { init } from './quartersbrief.conf.js';
import log from 'loglevel';
import { readFileSync } from 'fs';
import { gameObjectFactory } from './src/model/gameobjectfactory.js';
import { Ship } from './src/model/ship.js';
import { Modernization } from './src/model/modernization.js';
import { assertInvariants } from './src/quartersbrief.assert.js';
import process from 'process';
import node_readline from 'readline';




let data = JSON.parse(readFileSync('data/GameParams.json'));
try {
	assertInvariants(data);
} catch (x) {
	log.error(x.errors);
	process.exit(1);
}

gameObjectFactory.setEverything(data);

const readline = node_readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'Quarters Brief>' });
readline.prompt();
let ship;
readline.on('line', function(input) {
	let command = input.split(' ')[0].trim().toLowerCase();
	let param = input.split(' ').splice(1).join(' '); 

	switch (command) {
		case 'list':
			console.log(`Codes for ${param}: \n ${gameObjectFactory.listCodesForType(param)}`);
			break;
		case 'ship': 
			ship = gameObjectFactory.createGameObject(param);
			console.log(`Ship set to stock configuration of ${ship.name}`);
			break;
		case 'equip':
			ship.equipModules(param);
			console.log(`Ship ${ship.name} set to configuration ${param}`);
			break;
		case 'stat': 
			console.log(`Value is ${ship['get' + param].call(ship)}`);
			break;
		case 'exit':
			readline.close();
			process.exit(0);
	}
	readline.prompt();
});