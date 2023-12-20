import updateLabels from '../../src/update/update-labels.js';
import mockfs from 'mock-fs';
import path from 'path';
import fs from 'fs/promises';

describe('updateLabels', function() {
	const buildno = 1;
	const wowsdir = '/wows';
	const dest = '/data';

	let expected;

	before(async function() {
		expected = JSON.parse(await fs.readFile('test/update/testdata/global.json'));
	});

	afterEach(function() {
		mockfs.restore();
	});

	it('should turn labels from the game directory into global-en.json', async function() {		
		mockfs({
			[path.join(wowsdir, `/bin/${buildno}/res/texts/en/LC_MESSAGES/global.mo`)]: mockfs.load('test/update/testdata/global.mo'),
		});
		expect(await updateLabels(wowsdir, dest, buildno)).to.be.ok;

		const file = path.join(dest, 'global-en.json');
		expect(file).to.be.a.file();

		const actual = JSON.parse(await fs.readFile(file));
		// Delete metadata because we are not interested in that part
		delete actual[''];
		expect(actual).to.deep.equal(expected);		
	});
});