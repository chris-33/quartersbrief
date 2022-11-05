import updateLabels from '../../src/update/update-labels.js';
import mockfs from 'mock-fs';
import path from 'path';

describe('updateLabels', function() {
	const buildno = 1;
	const wowsdir = '/wows';
	const dest = '/data';

	// Can't pre-polulate mock filesystem directly here, because subsequent calls overwrite
	// instead of adding. I.e. if we did mockfs({[config.wowsdir]: {...}}) here, the subsequent
	// call in the test cases would cause mockfs to drop preferences.xml
	let prepopulated;
	beforeEach(function() {
		prepopulated = {
			[path.join(wowsdir, 'bin', String(buildno))]: {},
			[dest]: {},
		};
	});

	afterEach(function() {
		mockfs.restore();
	});

	it('should turn labels from the game directory into global-en.json', async function() {		
		const expected = {
			'': 'Content-Type: text/plain; charset=utf-8\nPlural-Forms: nplurals=2; plural=n != 1;\n',
			IDS_1: 'str1'			
		}
		mockfs({
			...prepopulated,
			[path.join(wowsdir, `/bin/${buildno}/res/texts/en/LC_MESSAGES/global.mo`)]: mockfs.load('test/update/testdata/global.mo'),
		});
		expect(await updateLabels(wowsdir, dest, buildno)).to.be.ok;
		expect(path.join(dest, 'global-en.json')).to.be.a.file().with.contents(JSON.stringify(expected));
	});

	it.skip('should revert labels to their previous version if the label update fails', async function() {
		mockfs({
			...prepopulated,
			[path.join(dest, 'global-en.json')]: 'preexisting',
			[path.join(wowsdir, `/bin/${buildno}/res/texts/en/LC_MESSAGES/global.mo`)]: 'malformed',
		});
		expect(await updateLabels(buildno)).to.be.false;
		expect(path.join(dest, 'global-en.json')).to.be.a.file().with.contents('preexisting');
	});
});