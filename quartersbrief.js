import { config } from './quartersbrief.conf.js';
import log from 'loglevel';
import { assertInvariants, InvariantError } from './src/quartersbrief.assert.js';
import { BattleController } from './src/core/battlecontroller.js';
import { GameObjectFactory } from './src/model/gameobjectfactory.js';
import { AgendaStore } from './src/briefing/agendastore.js';
import { SpecificityStrategy } from './src/briefing/specificitystrategy.js';
import createServers from './src/core/server.js';
import { BriefingMaker } from './src/core/briefingmaker.js';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import pug from 'pug';
import sass from 'sass';

try {
	config.required([ 'wowsdir' ]);
} catch (err) {
	log.error('Missing required parameter \'wowsdir\'. Either pass it using --wowsdir or set it in your quartersbrief.conf. Exiting.');
	process.exit(1);
}

// Make sure that the replays directory we will be watching actually exists
// If it doesn't, this is a non-recoverable error, because this program is pointless without it.
if (!existsSync(path.join(config.get('wowsdir'), 'replays'))) {
	log.error(`Could not find replays directory at ${path.join(config.get('wowsdir'), 'replays')}.\nReplays must be turned on for this program to work.\nSee https://eu.wargaming.net/support/en/products/wows/article/15038/ for information on how to enable replays.`);
	process.exit(1);
}
// Make sure that GameParams.json is available and load it if it is
let data;
if (!existsSync(path.join(config.get('datadir'), 'GameParams.json'))) {
	log.error(`Could not find game data at ${path.join(config.get('datadir'), 'GameParams.json')}`);
	process.exit(1);
} else {
	let t0 = Date.now();
	data = JSON.parse(readFileSync(path.join(config.get('datadir'),'GameParams.json')));
	log.info(`Loaded game data in ${Date.now() - t0}ms.`);
}

// Make sure that global-en.json is available and load it if it is
// But if it doesn't exist it's not fatal
let labels;
if (!existsSync(path.join(config.get('datadir'), 'global-en.json'))) {
	log.warn(`Could not find labels at ${path.join(config.get('datadir'), 'global-en.json')}`);
} else {
	let t0 = Date.now();
	labels = JSON.parse(readFileSync(path.join(config.get('datadir'),'global-en.json')));
	log.info(`Loaded labels in ${Date.now() - t0}ms.`);	
}


if (!config.get('skipInvariants')) {
	try {
		assertInvariants(data);
	} catch (err) {
		if (err instanceof AggregateError && err.errors.every(error => error instanceof InvariantError)) {
			log.error(`${err.message} ${err.errors.map(e => e.message + '\n')}.\nThis means that an important assumption this app depends upon to function correctly was not true.\nYou can start with the --skip-invariants option to disable invariant checking. Exiting.`);
			process.exit(1);
		} else {
			log.error(`${err} ${err.stack}`);
			process.exit(1);
		}
	}
} else {
	log.warn(`Skipped invariant checking.`);
}

const gameObjectFactory = new GameObjectFactory(data, labels);
const agendaStore = new AgendaStore(config.get('agendasdir'));
const battleController = new BattleController(path.join(config.get('wowsdir'), 'replays')); // No problem to hardcode this, because it is always the same according to https://eu.wargaming.net/support/en/products/wows/article/15038/
const briefingMaker = new BriefingMaker(path.join(config.get('wowsdir'), 'replays'), gameObjectFactory, agendaStore, new SpecificityStrategy());

const { srv, io } = createServers(config.get('host'), config.get('port'));

const indexTemplate = pug.compileFile('./src/core/index.pug');
let briefing;
srv.get('/', async function(req, res) {
	briefing = await briefingMaker.makeBriefing();	
	let html = indexTemplate({ briefing: briefing.html });
	res.send(html);
});

let quartersbriefcss;
srv.get('/quartersbrief.css', function(req, res) {
	res.type('text/css');
	if (!quartersbriefcss)
		quartersbriefcss = sass.compile('src/core/quartersbrief.scss').css;
	res.send(quartersbriefcss);
	// Disable caching in dev mode
	if (process.env.NODE_ENV === 'development')
		quartersbriefcss = null;
});

srv.get('/quartersbrief-briefing.css', function(req, res) {
	res.type('text/css');
	if (briefing.css)
		res.send(briefing.css);
	else
		res.status(404);
});

battleController.on('battlestart', function() {
	io.emit('battlestart');
});

battleController.on('battleend', function() {
	io.emit('battleend');
});

