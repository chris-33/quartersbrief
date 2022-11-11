#!/usr/bin/env node

import config, { paths } from './init/config.js';
import createconfig from './init/createconfig.js';
import './init/log.js';
import { needsUpdate, update } from './init/update.js';
import log from 'loglevel';
import loadData from './init/load.js';
import assertInvariants, { InvariantError } from './init/invariants.js';
import { GameObjectFactory } from './model/gameobjectfactory.js';
import Labeler from './model/labeler.js';
import BattleDataReader from './core/battledatareader.js';
import AgendaStore from './briefing/agendastore.js';
import SpecificityChooser from './briefing/specificitychooser.js';
import BriefingBuilder from './briefing/briefingbuilder.js';
import createServers from './init/servers.js';
import AgendaController from './core/agendacontroller.js';
import { BattleController } from './core/battlecontroller.js';
import BriefingController from './core/briefingcontroller.js';
import { existsSync } from 'fs';
import path from 'path';
import pug from 'pug';
import sass from 'sass';

process.chdir(paths.base);

await createconfig();

// Make sure the game directory is specified.
if (!config.wowsdir) {
	log.error(`Missing required parameters wowsdir. Either pass it using --wowsdir or set it in your quartersbrief.json. Exiting.`);
	process.exit(1);
}
// Make sure that the replays directory we will be watching actually exists
// If it doesn't, this is a non-recoverable error, because this program is pointless without it.
if (!existsSync(path.join(config.wowsdir, 'replays'))) {
	log.error(`Could not find replays directory at ${path.join(config.wowsdir, 'replays')}.\nReplays must be turned on for this program to work.\nSee https://eu.wargaming.net/support/en/products/wows/article/15038/ for information on how to enable replays.`);
	process.exit(1);
}

if (await needsUpdate())
	await update();

let { data, labels } = await loadData(paths.data);

if (!config.skipInvariants) {
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

const gameObjectFactory = new GameObjectFactory(data, new Labeler(labels));
const agendaController = new AgendaController([
	new AgendaStore(config.agendasdir)
], new SpecificityChooser(gameObjectFactory));
const battleController = new BattleController(path.join(config.wowsdir, 'replays')); // No problem to hardcode this, because it is always the same according to https://eu.wargaming.net/support/en/products/wows/article/15038/
const briefingController = new BriefingController(
	new BattleDataReader(path.join(config.wowsdir, 'replays')),
	new BriefingBuilder(gameObjectFactory),
	agendaController
);

const { srv, io } = createServers(config.host, config.port);

const indexTemplate = pug.compileFile('./src/core/index.pug');
srv.get('/', function(req, res) {
	let html = indexTemplate();
	res.send(html);
});

async function handler() {
	const briefing = await briefingController.createBriefing();	

	Object.keys(BriefingBuilder)
		.filter(key => key.startsWith('EVT_'))
		.map(key => BriefingBuilder[key])
		.forEach(eventName => briefing.on(eventName, function(...args) {
			let logstr = `Re-emitted event ${eventName}`;			
			if (eventName === BriefingBuilder.EVT_BRIEFING_TOPIC)
				logstr += ` for topic #${args[0]}`;
			log.debug(logstr);
			
			io.emit(eventName, ...args);
		}));
}
io.on('connect', handler);

const stylesheet = sass.compile('src/core/quartersbrief.scss').css;
srv.get('/quartersbrief.css', function(req, res) {
	res.type('text/css');
	res.send(stylesheet);
});

battleController.on('battlestart', function() {
	io.emit('battlestart');
	handler();
});

battleController.on('battleend', function() {
	io.emit('battleend');
});