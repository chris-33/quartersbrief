import ArmorViewer from '../../src/armor/armorviewer.js';
import mockfs from 'mock-fs';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

describe('ArmorViewer @integration', function() {
	const ARMOR_DIR = '/armor';
	const CACHE_DIR = '/cache';

	let noWarnings;

	let viewer;

	// front view of the armor model in TEST_DATA, including result re-orientation
	const FRONT_VIEW = {
		'1': [
			[ [ 1, -3 ], [ 3, -3 ], [ 3, -1 ], [ 1, -1 ] ]
		],
		'2': [
			[ [ -4, 1 ], [ -6, 1 ], [ -6, 3 ] ],
			[ [ -1, 1 ], [ -3, 1 ], [ -1, 3 ] , [ -3, 3 ] ]
		]
	}
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

	beforeEach(function() {		
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

	it('should create a view of the requested ship\'s armor if no cached file exists', async function() {
		const result = await viewer.view('AAA001_Battleship', 'front');
debugger
		expect(result).to.have.property('1');
		expect(result['1']).to.be.an('array').with.lengthOf(1);
		expect(result['1'][0]).to.have.deep.members(FRONT_VIEW['1'][0]);
	});

	it('should create a view of the requested ship\'s armor if a cached file exists but does not have the right hash', async function() {
		writeFileSync(path.join(CACHE_DIR, 'AAA001_Battleship.front.json'), JSON.stringify({
			view: {},
			metadata: {
				hash: 'wronghash'
			}
		}));
		const result = await viewer.view('AAA001_Battleship', 'front');

		expect(result).to.have.property('1');
		expect(result['1']).to.be.an('array').with.lengthOf(1);
		expect(result['1'][0]).to.have.deep.members(FRONT_VIEW['1'][0])
	});

	it('should use the saved view if one exists and has the right hash', async function() {
		const CACHE_DATA = {
			view: {
				1: []
			},
			metadata: TEST_DATA.metadata
		}
		writeFileSync(path.join(CACHE_DIR, 'AAA001_Battleship.front.json'), JSON.stringify(CACHE_DATA));

		const result = await viewer.view('AAA001_Battleship', 'front');

		expect(result).to.deep.equal(CACHE_DATA.view);
	});

	it('should write the created view to the armor file', async function() {
		const result = await viewer.view('AAA001_Battleship', 'front');

		const written = JSON.parse(readFileSync(path.join(CACHE_DIR, 'AAA001_Battleship.front.json')));
		expect(written).to.have.property('view').that.deep.equals(result);
		expect(written).to.have.nested.property('metadata.hash').that.equals(TEST_DATA.metadata.hash);
	});
});