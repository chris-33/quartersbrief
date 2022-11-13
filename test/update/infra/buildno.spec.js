import { latestBuild } from '../../../src/update/infra/buildno.js';
import mockfs from 'mock-fs';

describe('latestBuild', function() {
	const wowsdir = '/wows'

	afterEach(function() {
		mockfs.restore();
	});

	it('should return the highest build number', async function() {
		const builds = [ 123, 124, 125 ];
		const expected = Math.max(...builds);
		const bin = {};
		builds
			.map(buildno => ({ [`${wowsdir}/bin/${buildno}`]: {} }))
			.forEach(buildDir => Object.assign(bin, buildDir));
		mockfs(bin);
		return expect(latestBuild(wowsdir)).to.eventually.equal(expected);
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
		return expect(latestBuild(wowsdir)).to.eventually.equal(buildno);
	});

	it('should throw if it can\'t read the bin folder', function() {
		return expect(latestBuild(wowsdir)).to.be.rejected;
	});
});