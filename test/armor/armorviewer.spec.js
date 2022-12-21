import ArmorViewer from '../../src/armor/armorviewer.js';
import mockfs from 'mock-fs';
import { readFileSync } from 'fs';
import path from 'path';

describe('ArmorViewer', function() {
	const ARMOR_DIR = '/armor';

	let viewer;
	let TEST_DATA;

	beforeEach(function() {
		TEST_DATA = JSON.parse(readFileSync('test/armor/testdata/armor.json'));
	});

	beforeEach(function() {
		viewer = new ArmorViewer(ARMOR_DIR);
	});

	afterEach(function() {
		mockfs.restore();
	})

	it('should create a view of the requested ship\'s armor', async function() {
		mockfs({
			[ARMOR_DIR]: {
				'AAA001_Battleship.json': JSON.stringify(TEST_DATA)
			}
		});
		const expected = {
			'65585': [
				[ [ 1, 3 ], [ 3, 3 ], [ 3, 1 ], [ 1, 1 ] ]
			]
		}

		const result = await viewer.getView('AAA001_Battleship', 'front');

		expect(result).to.have.property('65585');
		expect(result['65585']).to.be.an('array').with.lengthOf(1);
		expect(result['65585'][0]).to.have.deep.members(expected['65585'][0])
	});

	it('should use the saved view if one exists', async function() {
		TEST_DATA.front = {
			65585: []
		}
		mockfs({
			[ARMOR_DIR]: {
				'AAA001_Battleship.json': JSON.stringify(TEST_DATA)
			}
		});

		const result = await viewer.getView('AAA001_Battleship', 'front');

		expect(result).to.deep.equal(TEST_DATA.front);
	});

	it('should write the created view to the armor file', async function() {
		mockfs({
			[ARMOR_DIR]: {
				'AAA001_Battleship.json': JSON.stringify(TEST_DATA)
			}
		});

		const result = await viewer.getView('AAA001_Battleship', 'front');

		expect(JSON.parse(readFileSync(path.join(ARMOR_DIR, 'AAA001_Battleship.json')))).to.have.property('front').that.deep.equals(result);
	});
});