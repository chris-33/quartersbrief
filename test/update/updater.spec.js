import Updater from '../../src/update/updater.js';
import path from 'path';
import fs from 'fs/promises';
import mockfs from 'mock-fs';
import sinon from 'sinon';
import { setImmediate } from 'timers/promises';

describe('Updater', function() {
	const wowsdir = '/wows';
	const dest = '/data';

	let updater;

	beforeEach(function() {
		updater = new Updater(wowsdir, dest);
	});

	afterEach(function() {
		mockfs.restore();
	});

	describe('.detectGameVersion', function() {
		it('should return the highest build number', async function() {
			const builds = [ 1, 2, 3 ];
			const expected = Math.max(...builds);
			const bin = {};
			builds
				.map(buildno => ({ [`${wowsdir}/bin/${buildno}`]: {} }))
				.forEach(buildDir => Object.assign(bin, buildDir));
			mockfs(bin);
			return expect(updater.detectGameVersion()).to.eventually.equal(expected);
		});

		it('should ignore files and subfolders not consisting only of digits', function() {
			const buildno = 1;
			const bin = {
				[`${wowsdir}/bin/${buildno}`]: {},
				[`${wowsdir}/bin/alphanumeric dir`]: {},
				[`${wowsdir}/bin/alphanumeric file`]: '',
				[`${wowsdir}/bin/${2 * buildno}`]: 'numeric file' // * 2 to make sure this is the highest
			}
			mockfs(bin);
			return expect(updater.detectGameVersion()).to.eventually.equal(buildno);
		});

		it('should throw if it can\'t read the bin folder', function() {
			return expect(updater.detectGameVersion()).to.be.rejected;
		});		
	});

	describe('.recallVersion', function() {
		it('should return the number from the .version file', async function() {
			const remembered = 1;
			mockfs({
				[dest]: {
					'.version': String(remembered)
				}
			});

			let result = await updater.recallVersion()
			expect(result).to.be.a('number');
			expect(result).to.equal(remembered);
		});

		it('should return undefined if the file does not exist', async function() {
			expect(await updater.recallVersion(), 'data directory does not exist').to.be.undefined;
			mockfs({ [dest]: {} });
			expect(await updater.recallVersion(), 'data directory exists but .version file does not').to.be.undefined;
		});

		it('should throw if the file exists but can not be accessed', function() {
			mockfs({ [dest]: {
				'.version': mockfs.file({ mode: 0o000 }) // Nobody is allowed to do anything with this file
			}});
			return expect(updater.recallVersion()).to.be.rejected;
		});

		it('should throw if the contents of the file are not a number', function() {
			mockfs({
				[dest]: { '.version': '1a' }
			});
			return expect(updater.recallVersion()).to.be.rejected;
		});
	});

	describe('.needsUpdate', function() {		
		it('should return true when the remembered version is lower than the current detected one', function() {
			const detected = 2;
			const remembered = 1;
			expect(updater.needsUpdate(detected, remembered)).to.be.true;
		});

		it('should return false when the remembered version is equal to the current detected one', function() {
			const detected = 2;
			const remembered = 2;
			expect(updater.needsUpdate(detected, remembered)).to.be.false;			
		});

		it('should return true if the remembered version is unknown', function() {
			const detected = 1;
			const remembered = undefined;
			expect(updater.needsUpdate(detected, remembered)).to.be.true;
		});

		it('should return true when the updatePolicy option is set to "force"', function() {
			const detected = 1;
			const remembered = 1;
			const updatePolicy = 'force';
			expect(updater.needsUpdate(detected, remembered, { updatePolicy })).to.be.true;
		});

		it('should return false when the updatePolicy option is set to "prohibit"', function() {
			const detected = 2;
			const remembered = 1;
			const updatePolicy = 'prohibit';
			expect(updater.needsUpdate(detected, remembered, { updatePolicy })).to.be.false;
		});
	});

	describe('.snapshot', function() {
		it(`should rename the data directory by attaching the suffix ${Updater.ROLLBACK_SUFFIX}`, async function() {			
			const expected = `${dest}${Updater.ROLLBACK_SUFFIX}`;
			mockfs({
				[dest]: {}
			});
			let result = await updater.snapshot();
			expect(dest).to.not.be.a.path();
			expect(expected).to.be.a.path();
			expect(result).to.equal(expected);
		});

		it('should return undefined if no current data existed', function() {
			mockfs({});
			return expect(updater.snapshot()).to.eventually.be.undefined;
		});
	});

	describe('.commit', function() {
		const buildno = 1;
		// eslint-disable-next-line mocha/no-setup-in-describe
		const rollback = `${dest}${Updater.ROLLBACK_SUFFIX}`;

		beforeEach(function() {
			mockfs({ 
				[dest]: {}, 
				[rollback]: {} });
		});

		it('should write the new data version to .version', async function() {
			await updater.commit(buildno, rollback);
			expect(path.join(dest, '.version')).to.be.a.file().with.contents(String(buildno));
		});

		it('should remove the rollback directory', async function() {
			await updater.commit(buildno, rollback);
			expect(rollback).to.not.be.a.path();
		});

		it('should not error if there is no rollback directory', async function() {
			await fs.rmdir(rollback);
			return expect(updater.commit(buildno)).to.be.fulfilled;
		});
	});

	describe('.rollback', function() {
		// eslint-disable-next-line mocha/no-setup-in-describe
		const rollback = `${dest}${Updater.ROLLBACK_SUFFIX}`;

		beforeEach(function() {
			mockfs({ 
				[dest]: { updated: '' }, 
				[rollback]: { rollback: ''}
			});
		});

		it('should overwrite the data directory with the rollback directory', async function() {
			expect(await updater.rollback(rollback)).to.be.true;
			// The rollback directory should no longer exist (because it was renamed)
			expect(rollback).to.not.be.a.path();
			// The data directory should have the contents of the rollback directory
			expect(dest).to.be.a.directory().with.contents([ 'rollback' ]);
		});

		it('should remove the data directory even if there was no rollback directory', async function() {
			await fs.rm(rollback, { force: true, recursive: true });
			
			expect(await updater.rollback()).to.be.false;
			expect(dest).to.not.be.a.path();
		});
	});

	describe('.update', function() {
		const remembered = 1;
		const detected = 2;

		beforeEach(function() {
			sinon.stub(updater, 'needsUpdate').resolves(true);
		});

		beforeEach(function() {
			mockfs({
				[path.join(wowsdir, 'bin', String(detected), 'idx')]: {},
				[dest]: { '.version': String(remembered) }
			});
		})

		it('should check if an update is needed', async function() {
			const options = {};
			await updater.update(options);
			expect(updater.needsUpdate).to.have.been.calledWith(detected, remembered, options);
		});

		it('should take a snapshot', async function() {
			sinon.stub(updater, 'snapshot').resolves();
			try {
				await updater.update();
				expect(updater.snapshot).to.have.been.called;
			} finally {
				updater.snapshot.restore();	
			}
		});

		it('should call all update functions', async function() {
			const updates = [
				sinon.stub().resolves(),
				sinon.stub().resolves()
			];
			updates.forEach(update => updater.register(update));
			await updater.update();
			updates.forEach(update => expect(update).to.have.been.called);
		});

		it('should wait until an update function has completed before calling the next', async function() {
			const updates = [ 			
				sinon.spy(async function() {
					// Push resolution of this promise to the end of this turn of the event loop.
					// This is so there is an opportunity for update() to call the next update function, even though
					// it shouldn't. 
					// If we tested directly (without setImmediate), the test would always pass.
					// (Not this is setImmediate imported from 'timers/promises')
					return setImmediate().then(function() {
						// Resolve the promise with the answer to the question: had the next update function already been
						// called when this one resolved?
						return Promise.resolve(updates[1].called); 
					})
				}),
				sinon.spy()
			];
			updates.forEach(update => updater.register(update));

			await updater.update();
			await expect(updates[0].firstCall.returnValue, 'second update function was called before first finished').to.eventually.be.false;
			expect(updates[1], 'second update function was never called at all').to.have.been.called;
		});

		it('should commit after all update functions complete normally', async function() {
			sinon.spy(updater, 'commit');
			sinon.spy(updater, 'rollback');
			try {
				updater.register(sinon.stub().resolves());
				await updater.update();
				expect(updater.commit).to.have.been.called;
				expect(updater.rollback).to.not.have.been.called;
			} finally {
				updater.commit.restore();
				updater.rollback.restore();
			}
		});

		it('should rollback if any update function throws', async function() {
			sinon.spy(updater, 'commit');
			sinon.spy(updater, 'rollback');
			try {
				updater.register(sinon.stub().rejects());
				await updater.update();
				expect(updater.commit).to.not.have.been.called;
				expect(updater.rollback).to.have.been.called;
			} finally {
				updater.commit.restore();
				updater.rollback.restore();
			}
		});

		it('should return -1 if no update was necessary, 0 if the update failed, and 1 if it was successful', async function() {
			const update = sinon.stub();
			updater.register(update);

			updater.needsUpdate.returns(false);
			await expect(updater.update()).to.eventually.equal(-1);
			
			updater.needsUpdate.returns(true);
			update.rejects();
			await expect(updater.update()).to.eventually.equal(0);

			update.resolves();
			await expect(updater.update()).to.eventually.equal(1);
		});
	});
});