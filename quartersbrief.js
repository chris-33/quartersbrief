import { init } from './quartersbrief.conf.js';
import log from 'loglevel';
import { readFileSync } from 'fs';
import { gameObjectFactory } from './src/model/gameobjectfactory.js';
import { Ship } from './src/model/ship.js';
import { Modernization } from './src/model/modernization.js';
import { assertInvariants } from './src/quartersbrief.assert.js';
import process from 'process';
import node_readline from 'readline';


const HELPTEXT = 'Known commands:\n' +
'		list <type>\t\t\tPrint all known reference codes that have that type\n' +
'		ship <ship>\t\t\tSet the current ship to <ship>. <ship> can be a numeric ID, a reference code, or a reference name' + 
'		modules <descriptor>\t\tSet the current ship\'s module configuration to <descriptor>\n' +
'		upgrade <upgrade>\t\tEquip an upgrade on the current ship. <upgrade> can be a numeric ID, a reference code, or a reference name\n' +
'		stat <property>\t\t\tPrint the value for the current ship\'s property, considering all equipped modules and upgrades';

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
		case 'modules':
			ship.equipModules(param);
			console.log(`Ship ${ship.name} set to configuration ${param}`);
			break;
		case 'upgrade':
			let upgrade = gameObjectFactory.createGameObject(param);
			if (ship.equipModernization(upgrade))
				console.log(`Equipped upgrade ${upgrade.getName()} on ${ship.name}`);
			else console.log(`Ship ${ship.name} is not eligible for upgrade ${upgrade.getName()}`)
			break;
		case 'stat': 
			console.log(`Value is ${ship['get' + param].call(ship)}`);
			break;
		case 'help':
			console.log(HELPTEXT);
			break;
		case 'exit':
			readline.close();
			process.exit(0);
		default: 
			console.log(`Unknown command ${command}. Type help to see a list of possible commands.`);
	}
	readline.prompt();
});