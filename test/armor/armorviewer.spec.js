import mockfs from 'mock-fs';
import esmock from 'esmock';
import sinon from 'sinon';
import { readFileSync, writeFileSync, rmSync } from 'fs';
import path from 'path';
import Ship from '../../src/model/ship.js';

describe('ArmorViewer', function() {
	const ARMOR_DIR = '/armor';
	const CACHE_DIR = '/cache';

	let noWarnings;

	let createView;
	let viewer;

	let TEST_DATA;

	// Ugly hack to temporarily disable the "custom ESM loaders are experimental" warning emitted by NodeJS
	// Otherwise the warning will get emitted for every worker that is spun up, polluting the test output
	before(function() {
		noWarnings = process.env.NODE_NO_WARNINGS;
		process.env.NODE_NO_WARNINGS = 1;
	});

	after(function() {
		process.env.NODE_NO_WARNINGS = noWarnings;
	});

	beforeEach(function() {
		TEST_DATA = JSON.parse(readFileSync('test/armor/testdata/armor.json'));
	});

	beforeEach(async function() {
		createView = sinon.stub().returns({});
		let ArmorViewer = (await esmock('../../src/armor/armorviewer.js', {
			'../../src/armor/create-view.js': {
				default: createView
			}
		})).default;
		viewer = new ArmorViewer(ARMOR_DIR, CACHE_DIR);
	});

	beforeEach(function() {
		mockfs({
			[ARMOR_DIR]: {
				'AAA001_Battleship.json': JSON.stringify(TEST_DATA)
			},
			[CACHE_DIR]: {},
			// Ugly hack to make the thread worker module available for import.
			// threads.js needs this to spin up worker threads in its pool, because the worker's code (i.e., module) is loaded at runtime. 
			// Pretty much no multithreading library atm supports creating worker threads from a function, which, as it is a limitation
			// of the core NodeJS module (worker_threads) seems unlikely to change.
			// The library workerpool (https://www.npmjs.com/package/workerpool) has a way, but it requires serializing the function in
			// question to a string with EVERY CALL, and seems to have its own share of problems and limitations
			// (as seen in https://github.com/piscinajs/piscina/issues/140#issuecomment-1146697878)
			// 
			// For the time being, we will use this workaround. In the future, https://github.com/tc39/proposal-module-expressions might 
			// provide the right tool for a more elegant way of instantiating worker threads.
			[`${process.cwd()}/src/armor/occlude-worker.js`]: mockfs.load(`${process.cwd()}/src/armor/occlude-worker.js`)
		}, { createCwd: false });
	});

	afterEach(function() {
		mockfs.restore();
	});

	it('should accept a Ship object', async function() {
		const ship = Object.create(Ship.prototype);
		ship.hull = {
			model: 'content/gameplay/usa/ship/battleship/AAA001_Battleship/AAA001_Battleship.model'
		};
		
		await viewer.view(ship, 'front');
		// Reset viewer and cache:
		viewer.cache = {};
		rmSync(path.join(CACHE_DIR, 'AAA001_Battleship.json'), { force: true });
		await viewer.view('AAA001_Battleship', 'front');

		expect(createView).to.have.been.calledTwice;
		expect(createView.firstCall.firstArg).to.deep.equal(createView.secondCall.firstArg);
	});

	it('should create a view of the requested ship\'s armor if no cached file exists', async function() {
		await viewer.view('AAA001_Battleship', 'front');

		expect(createView).to.have.been.called;
	});

	it('should create a view of the requested ship\'s armor if a cached file exists but does not hold the view', async function() {
		writeFileSync(path.join(CACHE_DIR, 'AAA001_Battleship.json'), JSON.stringify({
			side: {},
			metadata: TEST_DATA.metadata
		}));
		await viewer.view('AAA001_Battleship', 'front');

		expect(createView).to.have.been.called;
	});

	it('should create a view of the requested ship\'s armor if a cached file exists but does not have the right hash', async function() {
		writeFileSync(path.join(CACHE_DIR, 'AAA001_Battleship.json'), JSON.stringify({
			front: {},
			metadata: {
				hash: 'wronghash'
			}
		}));
		await viewer.view('AAA001_Battleship', 'front');

		expect(createView).to.have.been.called;
	});

	it('should use the saved view if one exists and has the right hash', async function() {
		const CACHE_DATA = {
			front: {
				1: []
			},
			metadata: TEST_DATA.metadata
		}
		writeFileSync(path.join(CACHE_DIR, 'AAA001_Battleship.json'), JSON.stringify(CACHE_DATA));

		await viewer.view('AAA001_Battleship', 'front');

		expect(createView).to.not.have.been.called;
	});

	it('should create the cache dir if it does not exist', async function() {
		rmSync(CACHE_DIR, { force: true, recursive: true });
		expect(CACHE_DIR).to.not.be.a.path();

		await viewer.view('AAA001_Battleship', 'front');
		expect(CACHE_DIR).to.be.a.directory();
	});

	it('should write the created view to the armor file', async function() {
		const result = await viewer.view('AAA001_Battleship', 'front');

		expect(path.join(CACHE_DIR, 'AAA001_Battleship.json')).to.be.a.file().with.json;
		const written = JSON.parse(readFileSync(path.join(CACHE_DIR, 'AAA001_Battleship.json')));
		expect(written).to.have.property('front').that.deep.equals(result);
		expect(written).to.have.nested.property('metadata.hash').that.equals(TEST_DATA.metadata.hash);
	});
});