import esmock from 'esmock';
import mockfs from 'mock-fs';

describe('latestBuild', function() {
	let latestBuild;

	const config = {
		wowsdir: '/wows'
	};

	beforeEach(async function() {
		this.timeout(3000); // Loading of the modules sometimes takes a while, so increase the timeout to 3s

		// Do a dynamic import so we can supply a mock config.js
		({ latestBuild } = (await esmock('../../src/update/buildno.js', {}, {
			'../../src/init/config.js': { default: config },
		})));
	});

	afterEach(function() {
		mockfs.restore();
	});

	it('should return the highest build number', async function() {
		const builds = [ 123, 124, 125 ];
		const expected = Math.max(...builds);
		const bin = {};
		builds
			.map(buildno => ({ [`${config.wowsdir}/bin/${buildno}`]: {} }))
			.forEach(buildDir => Object.assign(bin, buildDir));
		mockfs(bin);
		return expect(latestBuild()).to.eventually.equal(expected);
	});

	it('should ignore files and subfolders not consisting only of digits', function() {
		const buildno = 1;
		const bin = {
			[`${config.wowsdir}/bin/${buildno}`]: {},
			[`${config.wowsdir}/bin/alphanumeric dir`]: {},
			[`${config.wowsdir}/bin/alphanumeric file`]: '',
			[`${config.wowsdir}/bin/${2 * buildno}`]: 'numeric file' // * 2 to make sure this is the highest
		}
		mockfs(bin);
		return expect(latestBuild()).to.eventually.equal(buildno);
	});

	it('should throw if it can\'t read the bin folder', function() {
		return expect(latestBuild()).to.be.rejected;
	});
});