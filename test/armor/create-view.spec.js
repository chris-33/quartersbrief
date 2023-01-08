import createView from '../../src/armor/create-view.js';
import esmock from 'esmock';
import sinon from 'sinon';
import { readFileSync } from 'fs';

describe('createView', function() {
	let TEST_DATA;

	// Ugly hack to temporarily disable the "custom ESM loaders are experimental" warning emitted by NodeJS
	// Otherwise the warning will get emitted for every worker that is spun up, polluting the test output
	let noWarnings;
	before(function() {
		noWarnings = process.env.NODE_NO_WARNINGS;
		process.env.NODE_NO_WARNINGS = 1;
	});

	after(function() {
		process.env.NODE_NO_WARNINGS = noWarnings;
	});

	beforeEach(function() {
		TEST_DATA = JSON.parse(readFileSync('test/armor/testdata/armor.json')).armor;
	});

	it('should return arrays of polygons with the 2D representations of all armor pieces', async function() {
		const expected = {
			'1': [
				[ [ 1, 3 ], [ 3, 3 ], [ 3, 1 ], [ 1, 1 ] ]
			],
			'2': [
				[ [ -4, -1 ], [ -6, -1 ], [ -6, -3 ] ],
				[ [ -1, -1 ], [ -3, -1 ], [ -1, -3 ] , [ -3, -3 ] ]
			]
		}

		const result = await createView(TEST_DATA, 2);

		expect(result).to.have.property('1').that.is.an('array').with.lengthOf(1);
		expect(result['1'][0]).to.have.deep.members(expected['1'][0]);
		expect(result).to.have.property('2').that.is.an('array').with.lengthOf(2);
		expect(result['2'][0]).to.have.deep.members(expected['2'][0]);
		expect(result['2'][1]).to.have.deep.members(expected['2'][1]);
	});	

	describe('zero-length errors when assembling result polygons', function() {
		let createView;
		let polybool;

		beforeEach(async function() {
			polybool = (await import('polybooljs')).default;
			sinon.stub(polybool, 'selectUnion').callThrough();
			createView = (await esmock('../../src/armor/create-view.js', {
				'polybooljs': polybool
			})).default;
		});

		afterEach(function() {
			polybool.selectUnion.restore();
		});

		it('should realign and retry upon the first zero-length error', async function() {
			const expected = [ [ 1, 3 ], [ 3, 3 ], [ 3, 1 ], [ 1, 1 ] ];
			polybool.selectUnion
				.onFirstCall().throws(new TypeError('Zero-length segment detected'));

			const p = createView(TEST_DATA, 2);
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

			return expect(createView(TEST_DATA, 2)).to
				// The zero-length error we simulated polybool throwing should be swallowed:
				.be.fulfilled
				// The erroring triangle should have been omitted from the result, making the result
				// a triangle instead of a square:
				.and.eventually.have.nested.property('1[0]').that.is.an('array').with.lengthOf(3);
		});

	});
});