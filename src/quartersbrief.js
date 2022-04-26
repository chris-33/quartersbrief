#!/usr/bin/env node

import config, { paths } from './init/config.js';
import createconfig from './init/createconfig.js';
import './init/log.js';
import { needsUpdate, update } from './init/update.js';
import log from 'loglevel';
import loadData from './init/load.js';
import assertInvariants, { InvariantError } from './init/invariants.js';
import { BattleController } from './core/battlecontroller.js';
import { GameObjectFactory } from './model/gameobjectfactory.js';
import { AgendaStore } from './briefing/agendastore.js';
import { SpecificityStrategy } from './briefing/specificitystrategy.js';
import createServers from './init/servers.js';
import { BriefingMaker } from './core/briefingmaker.js';
import { existsSync, readFileSync } from 'fs';
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

const gameObjectFactory = new GameObjectFactory(data, labels);
const agendaStore = new AgendaStore(config.agendasdir);
const battleController = new BattleController(path.join(config.wowsdir, 'replays')); // No problem to hardcode this, because it is always the same according to https://eu.wargaming.net/support/en/products/wows/article/15038/
const strategy = new SpecificityStrategy(gameObjectFactory);
const briefingMaker = new BriefingMaker(path.join(config.wowsdir, 'replays'), gameObjectFactory, agendaStore, strategy);

const { srv, io } = createServers(config.host, config.port);

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
		res.status(404).end();
});

battleController.on('battlestart', function() {
	io.emit('battlestart');
});

battleController.on('battleend', function() {
	io.emit('battleend');
});