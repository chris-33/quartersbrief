import mockfs from 'mock-fs';
import esmock from 'esmock';
import * as _steps from '../../src/update/infra/steps.js';
import path from 'path';
import sinon from 'sinon';
import fs from 'fs/promises';
import os from 'os';

describe('updateArmor', function() {
	const buildno = 1;
	const wowsdir = '/wows';
	const dest = '/data';

	const geometry = 'AAA001_Battleship';
	let data;
	let expected;

	let extract;
	
	let updateArmor;

	before(async function() {
		data = await fs.readFile('test/update/testdata/armor.geometry');
		expected = JSON.parse(await fs.readFile('test/update/testdata/armor.json'));
	});

	beforeEach(function() {
		extract = sinon.stub().callsFake(function(wows, dest) {
			return sinon.stub().callsFake(async function() {				
				let extracted = path.join(dest, 'content/gameplay/nation/ship/battleship/');
				await fs.mkdir(extracted, { recursive: true });
				extracted = path.join(extracted, geometry);
				await fs.writeFile(extracted, data);
				return Promise.resolve([ extracted ]);
			});
		});
	});

	beforeEach(async function() {
		const steps = {
			..._steps,
			extract
		}
		// Use esmock strict mode here, to that invariants get replaced instead of merged
		updateArmor = (await esmock('../../src/update/update-armor.js', {}, {
				'../../src/update/infra/steps.js': steps,
		})).default;		
	});

	afterEach(function() {
		mockfs.restore();
	});

	it('should turn the armor section of the .geometry file .json', async function() {		
		mockfs({
			[path.join(wowsdir, 'bin', String(buildno))]: {},
			[dest]: {},
		});

		expect(await updateArmor(wowsdir, dest, buildno)).to.be.ok;
		expect(path.format({
			dir: path.join(dest, 'armor'),
			name: geometry,
			ext: '.json'
		})).to.be.a.file().with.contents(JSON.stringify(expected));
	});

	it('should delete the extracted files from the tmp folder', async function() {
		mockfs({
			[path.join(wowsdir, 'bin', String(buildno))]: {},
			[dest]: {},
		});
		await updateArmor(wowsdir, dest, buildno);
		expect(path.join(os.tmpdir(), 'armor')).to.not.be.a.path();
	});
});