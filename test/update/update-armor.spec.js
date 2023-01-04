import mockfs from 'mock-fs';
import esmock from 'esmock';
import * as _steps from '../../src/update/infra/steps.js';
import path from 'path';
import sinon from 'sinon';
import fs from 'fs/promises';
import { readFileSync } from 'fs';
import os from 'os';

describe('updateArmor', function() {
	function mockExtractor(resource) {
		return function(wows, dest) {
			return sinon.stub().callsFake(async function() {				
				let extracted = path.join(dest, 'content/gameplay/nation/ship/battleship/');
				await fs.mkdir(extracted, { recursive: true });
				extracted = path.join(extracted, geometry);
				await fs.writeFile(extracted, resource);
				return Promise.resolve([ extracted ]);
			});
		};
	}

	const buildno = 1;
	const wowsdir = '/wows';
	const dest = '/data';

	const geometry = 'AAA001_Battleship';
	let data;
	let expected;

	let extract;
	
	let updateArmor;

	beforeEach(async function() {
		data = await fs.readFile('test/update/testdata/armor.geometry');
		expected = JSON.parse(await fs.readFile('test/update/testdata/armor.json'));
	});

	beforeEach(function() {
		extract = sinon.stub().callsFake(mockExtractor(data));
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

	beforeEach(function() {
		mockfs({
			[path.join(wowsdir, 'bin', String(buildno))]: {},
			[dest]: {},
		});
	});

	afterEach(function() {
		mockfs.restore();
	});

	it('should turn the armor section of the .geometry file .json', async function() {		
		expect(await updateArmor(wowsdir, dest, buildno)).to.be.ok;
		const filename = path.format({
			dir: path.join(dest, 'armor'),
			name: geometry,
			ext: '.json'
		});

		expect(filename).to.be.a.file().with.json;
		const contents = JSON.parse(await fs.readFile(filename));
		expect(contents).to.have.property('armor');		
		expect(contents.armor).to.have.keys([ 1, 2, 3 ]);
		expect(contents.armor[1]).to.deep.equal(expected.armor[1]);
		expect(contents.armor[2]).to.deep.equal(expected.armor[2]);
		expect(contents.armor[3]).to.be.an('array').with.lengthOf(1); // Should have been cut, will be checked in a dedicated test
	});

	it('should cut the model at the water line', async function() {
		expect(await updateArmor(wowsdir, dest, buildno)).to.be.ok;
		const filename = path.format({
			dir: path.join(dest, 'armor'),
			name: geometry,
			ext: '.json'
		});

		expect(filename).to.be.a.file().with.json;
		const piece = JSON.parse(await fs.readFile(filename)).armor['3'];
		expect(piece).to.be.an('array').with.lengthOf(1);
		expect(piece[0]).to.deep.include.members([ [ 3, 1, 0 ], [ 3, 0, 0 ], [ 2, 0, 0 ] ]);
	});

	it('should be able to handle .geometry files that have no armor section', async function() {
		// Some ships in the game have geometry files that have no armor section (e.g. transports and such)
		// Make sure our update code can handle that
		extract.callsFake(mockExtractor(mockfs.bypass(() => readFileSync('test/update/testdata/empty-armor.geometry'))));

		expect(await updateArmor(wowsdir, dest, buildno)).to.be.ok;
		const filename = path.format({
			dir: path.join(dest, 'armor'),
			name: geometry,
			ext: '.json'
		});

		expect(filename).to.be.a.file().with.json;
		const contents = JSON.parse(await fs.readFile(filename));
		expect(contents).to.have.property('armor').that.is.empty;
	});

	it('should write section size and hash to the json file', async function() {
		expect(await updateArmor(wowsdir, dest, buildno)).to.be.ok;
		const filename = path.format({
			dir: path.join(dest, 'armor'),
			name: geometry,
			ext: '.json'
		});

		expect(filename).to.be.a.file().with.json;
		expect(JSON.parse(await fs.readFile(filename))).to.deep.include({ metadata: expected.metadata });		
	});

	it('should delete the extracted files from the tmp folder', async function() {
		await updateArmor(wowsdir, dest, buildno);
		expect(path.join(os.tmpdir(), 'armor')).to.not.be.a.path();
	});
});