import findGame from '../../src/init/find-game.js';
import mockfs from 'mock-fs';
import path from 'path';
import fs from 'fs/promises';

describe('findGame', function() {
	const EXECUTABLE = 'WorldOfWarships.exe';

	it('should be callable with a string or an array and throw otherwise', async function() {
		await expect(findGame('')).to.eventually.be.fulfilled;
		await expect(findGame([])).to.eventually.be.fulfilled;
		await expect(findGame(null)).to.be.rejected;
	});

	it('should allow game executable to be part of supplied search path', async function() {
		const PATH = '/game';
		mockfs({
			[PATH]: {
				[EXECUTABLE]: ''
			}
		});
		return expect(findGame(`${PATH}/${EXECUTABLE}`)).to.eventually.equal(PATH);
	});

	it('should search for game executable in all supplied paths', function() {
		const PATHS = [ '/attempt1', '/attempt2' ];
		mockfs({
			[PATHS[0]]: {},
			[PATHS[1]]: {
				[EXECUTABLE]: ''
			}
		});

		return expect(findGame(PATHS)).to.eventually.equal(PATHS[1]);
	});

	it('should search for game executable in all subfolders of supplied paths', function() {
		const PATH = '/parent/child';
		mockfs({
			[path.join(PATH, EXECUTABLE)]: ''
		});

		return expect(findGame([ PATH ])).to.eventually.equal(PATH);
	});

	it('should skip folders when privileges aren\'t sufficient', function() {
		const PATHS = [ '/attempt1', '/attempt2' ];
		mockfs({
			[PATHS[0]]: mockfs.directory({ mode: 0, items: {
				[EXECUTABLE]: ''
			}}),
			[PATHS[1]]: {
				[EXECUTABLE]: ''
			}
		});

		return expect(findGame(PATHS)).to.eventually.equal(PATHS[1]);
	});
});