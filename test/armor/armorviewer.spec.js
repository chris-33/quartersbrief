import ArmorViewer from '../../src/armor/armorviewer.js';
import mockfs from 'mock-fs';
import sinon from 'sinon';
import { readFileSync, writeFileSync, rmSync } from 'fs';
import path from 'path';
import Ship from '../../src/model/ship.js';

describe('ArmorViewer', function() {
	const ARMOR_DIR = '/armor';
	const CACHE_DIR = '/cache';

	let noWarnings;

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

	beforeEach(function() {
		viewer = new ArmorViewer(ARMOR_DIR, CACHE_DIR);
	});

	afterEach(function() {
		// Need to manually terminate the worker thread pool.
		// Otherwise, mocha will not exit, unless run with the --exit flag.
		// (Not a problem in the production code, where killing the process will always kill the threads)
		return viewer.pool.terminate();
	});

	describe('.createView', function() {
		beforeEach(function() {
			TEST_DATA = TEST_DATA.armor;
		});

		it('should return arrays of polygons with the 2D representations of all armor pieces', async function() {
			const expected = {
				'1': [
					[ 
						[ 1 - ArmorViewer.PRECISION, 3 + ArmorViewer.PRECISION ], 
						[ 3 + ArmorViewer.PRECISION, 3 + ArmorViewer.PRECISION ], 
						[ 3 + ArmorViewer.PRECISION, 1 - ArmorViewer.PRECISION ], 
						[ 1 - ArmorViewer.PRECISION, 1 - ArmorViewer.PRECISION ] 
					]
				],
				'2': [
					[ 
						[ -4 + ArmorViewer.PRECISION, -1 + ArmorViewer.PRECISION ], 
						[ -6 - ArmorViewer.PRECISION, -1 + ArmorViewer.PRECISION ], 
						[ -6 - ArmorViewer.PRECISION, -3 - ArmorViewer.PRECISION ] 
					], [ 
						[ -1 + ArmorViewer.PRECISION, -1 + ArmorViewer.PRECISION ], 
						[ -3 - ArmorViewer.PRECISION, -1 + ArmorViewer.PRECISION ], 
						[ -1 + ArmorViewer.PRECISION, -3 - ArmorViewer.PRECISION ] , 
						[ -3 - ArmorViewer.PRECISION, -3 - ArmorViewer.PRECISION ] 
					]
				]
			}

			const result = await viewer.createView(TEST_DATA, 2);

			expect(result).to.have.property('1').that.is.an('array').with.lengthOf(1);
			expect(result['1'][0]).to.have.deep.members(expected['1'][0]);
			expect(result).to.have.property('2').that.is.an('array').with.lengthOf(2);
			expect(result['2'][0]).to.have.deep.members(expected['2'][0]);
			expect(result['2'][1]).to.have.deep.members(expected['2'][1]);
		});	

		describe('zero-length errors when assembling result polygons', function() {
			let polybool;

			beforeEach(async function() {
				polybool = (await import('polybooljs')).default;
				sinon.stub(polybool, 'selectUnion').callThrough();
			});

			afterEach(function() {
				polybool.selectUnion.restore();
			});

			it('should realign and retry upon the first zero-length error', async function() {
				const expected = [ 
					[ 1 - ArmorViewer.PRECISION, 3 + ArmorViewer.PRECISION ], 
					[ 3 + ArmorViewer.PRECISION, 3 + ArmorViewer.PRECISION ], 
					[ 3 + ArmorViewer.PRECISION, 1 - ArmorViewer.PRECISION ], 
					[ 1 - ArmorViewer.PRECISION, 1 - ArmorViewer.PRECISION ] 
				];
				polybool.selectUnion
					.onFirstCall().throws(new TypeError('Zero-length segment detected'));

				const p = viewer.createView(TEST_DATA, 2);
				// The zero-length error we simulated polybool throwing should be swallowed:
				await expect(p).to.be.fulfilled;
				
				const result = await p;
				expect(result).to.have.nested.property('1[0]').that.is.an('array').with.deep.members(expected);
				// There should have been a second call to selectUnion, and since the input was not actually misaligned
				// it should have mirrored the first call
				expect(polybool.selectUnion.secondCall.args).to.deep.equal(polybool.selectUnion.firstCall.args);
			});

			it('should ignore the offending triangle upon the second zero-length error', async function() {
				polybool.selectUnion
					.callThrough()
					.onFirstCall().throws(new TypeError('Zero-length segment detected'))
					.onSecondCall().throws(new TypeError('Zero-length segment detected'));

				return expect(viewer.createView(TEST_DATA, 2)).to
					// The zero-length error we simulated polybool throwing should be swallowed:
					.be.fulfilled
					// The erroring triangle should have been omitted from the result, making the result
					// a triangle instead of a square:
					.and.eventually.have.nested.property('1[0]').that.is.an('array').with.lengthOf(3);
			});

		});
	});
	
	describe('.view', function() {
		beforeEach(async function() {
			sinon.stub(viewer, 'createView').resolves({});
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
			rmSync(path.join(CACHE_DIR, 'AAA001_Battleship.front.json'), { force: true });
			await viewer.view('AAA001_Battleship', 'front');

			expect(viewer.createView).to.have.been.calledTwice;
			expect(viewer.createView.firstCall.firstArg).to.deep.equal(viewer.createView.secondCall.firstArg);
		});

		it('should create a view of the requested ship\'s armor if no cached file exists', async function() {
			await viewer.view('AAA001_Battleship', 'front');

			expect(viewer.createView).to.have.been.called;
		});

		it('should create a view of the requested ship\'s armor if a cached file exists but does not have the right hash', async function() {
			writeFileSync(path.join(CACHE_DIR, 'AAA001_Battleship.front.json'), JSON.stringify({
				view: {},
				metadata: {
					hash: 'wronghash'
				}
			}));
			await viewer.view('AAA001_Battleship', 'front');

			expect(viewer.createView).to.have.been.called;
		});

		it('should use the saved view if one exists and has the right hash', async function() {
			const CACHE_DATA = {
				view: {
					1: []
				},
				metadata: TEST_DATA.metadata
			}
			writeFileSync(path.join(CACHE_DIR, 'AAA001_Battleship.front.json'), JSON.stringify(CACHE_DATA));

			await viewer.view('AAA001_Battleship', 'front');

			expect(viewer.createView).to.not.have.been.called;
		});

		it('should create the cache dir if it does not exist', async function() {
			rmSync(CACHE_DIR, { force: true, recursive: true });
			expect(CACHE_DIR).to.not.be.a.path();

			await viewer.view('AAA001_Battleship', 'front');
			expect(CACHE_DIR).to.be.a.directory();
		});

		it('should write the created view to the armor file', async function() {
			const result = await viewer.view('AAA001_Battleship', 'front');

			expect(path.join(CACHE_DIR, 'AAA001_Battleship.front.json')).to.be.a.file().with.json;
			const written = JSON.parse(readFileSync(path.join(CACHE_DIR, 'AAA001_Battleship.front.json')));
			expect(written).to.have.property('view').that.deep.equals(result);
			expect(written).to.have.nested.property('metadata.hash').that.equals(TEST_DATA.metadata.hash);
		});

		it('should only create the view once even if requested again while still generating', async function() {				
			const expected = {};
			let liftGuard;
			let finish;
			// A promise we can await until createView has actually been called.
			// What we are trying to simulate here is a second call coming in to viewer.view() in the time between cache lookup
			// having failed (and thus, createView having been called) and view creation completing. So, unlike in the above tests,
			// we can't just do await viewer.view(). 
			// But we also can't do viewer.view(); viewer.view() either, because the caching strategy itself involves asynchronous calls,
			// and we need to allow time for that (viewer.cache needs to have time to get set, which can only happen AFTER asynchronous 
			// file system calls have come up empty). 
			// So we will install a manual guard (in the form of a promise) that we can use to make sure the second call to viewer.view() is
			// placed AFTER caching has failed and createView has actually been called.
			const guard = new Promise(resolve => liftGuard = resolve);
			viewer.createView.callsFake(function() {
				liftGuard();
				return new Promise(resolve => finish = resolve);
			});

			// First call
			const first = viewer.view('AAA001_Battleship', 'front');
			// Delay second call until createView has been called
			await guard;
			const second = viewer.view('AAA001_Battleship', 'front');
			// After the second call has been placed, simulate createView finishing
			finish(expected);
			// If the ArmorViewer cached the promise (as opposed to the await'ed result of the promise), there should only be one call to createView()
			expect(viewer.createView).to.have.been.calledOnce;
			// Both calls should correctly resolve to expected
			return expect(first).to.eventually.equal(await second).and.equal(expected);
		});
	});
});