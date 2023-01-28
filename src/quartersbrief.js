#!/usr/bin/env node

import config from './init/config.js';
import * as paths from './init/paths.js';
import './init/log.js';
import update from './init/update.js';
import log from 'loglevel';
import loadData from './init/load.js';
import PlayerFactory from './model/playerfactory.js';
import GameObjectFactory from './model/gameobjectfactory.js';
import ArmorViewer from './armor/armorviewer.js';
import Labeler from './model/labeler.js';
import BattleDataReader from './core/battledatareader.js';
import SpecificityChooser from './agendas/specificitychooser.js';
import BriefingBuilder from './briefing/briefingbuilder.js';
import createServers from './init/servers.js';
import AgendaController from './core/agendacontroller.js';
import BattleController from './core/battlecontroller.js';
import BriefingController from './core/briefingcontroller.js';
import { existsSync } from 'fs';
import path from 'path';
import pug from 'pug';
import sass from 'sass';

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

let version = await update();
let datadir = path.join(paths.DATA_DIR, String(version));

let data, labels;
try {
	const t0 = Date.now();
	({ data, labels } = await loadData(datadir));
	log.info(`Loaded game data in ${Date.now() - t0}ms.`);
} catch(err) {
	log.error(`Could not load data from ${paths.DATA_DIR}: ${err.message}. Try running quartersbrief with update-policy=force`);
	process.exit(1);
}
if (labels instanceof Error) {
	log.warn(`Could not load labels from ${paths.DATA_DIR}: ${labels.message}. Labels will be unavailable.`);
	labels = undefined;
}

const gameObjectFactory = new GameObjectFactory(data, new Labeler(labels));
const agendaController = await AgendaController.create(
	[ paths.AGENDAS_USER_DIR, paths.AGENDAS_DEFAULT_DIR ], 
	new SpecificityChooser(gameObjectFactory));
const battleController = new BattleController(path.join(config.wowsdir, 'replays')); // No problem to hardcode this, because it is always the same according to https://eu.wargaming.net/support/en/products/wows/article/15038/
const briefingController = new BriefingController(
	new BattleDataReader(path.join(config.wowsdir, 'replays')),
	new BriefingBuilder({
		gameObjectFactory,
		playerFactory: new PlayerFactory(config.apiKey, config.realm),
		armorViewer: new ArmorViewer(path.join(datadir, 'armor'), path.join(paths.CACHE_DIR, 'armor'))
	}),
	agendaController
);

const { srv, io } = createServers(config.host, config.port);

const indexTemplate = process.env.NODE_ENV === 'development' ? 
	(...args) => pug.renderFile(path.join(paths.BASE_DIR, 'src/core/index.pug'), ...args) : 
	pug.compileFile(path.join(paths.BASE_DIR, 'src/core/index.pug'));

srv.get('/', function(req, res) {
	let html = indexTemplate();
	res.send(html);
});

async function handler() {
	const briefing = await briefingController.createBriefing();	

	Object.keys(BriefingBuilder)
		.filter(key => key.startsWith('EVT_'))
		.map(key => BriefingBuilder[key])
		.forEach(eventName => briefing.on(eventName, function reEmit(...args) {
			let logstr = `Re-emitted event ${eventName}`;			
			if (eventName === BriefingBuilder.EVT_BRIEFING_TOPIC)
				logstr += ` for topic #${args[0]}`;
			log.debug(logstr);
			
			io.emit(eventName, ...args);
		}));
}
io.on('connect', handler);

let stylesheet;
srv.get('/quartersbrief.css', function(req, res) {
	res.type('text/css');
	// Force recompilation on every request in development mode
	if (!stylesheet || process.env.NODE_ENV === 'development')
		stylesheet = sass.compile(path.join(paths.BASE_DIR, 'src/core/quartersbrief.scss'), {
			loadPaths: [path.join(paths.BASE_DIR,'node_modules')],
			functions: {
				'scrollSnap()': function() {
					return config.scrollSnap ? sass.sassTrue : sass.sassFalse
				}
			}
		}).css;
	res.send(stylesheet);
});

battleController.on('battlestart', function() {
	io.emit('battlestart');
	handler();
});

battleController.on('battleend', function() {
	io.emit('battleend');
});