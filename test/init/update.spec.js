import mockfs from 'mock-fs';
import path from 'path';
import esmock from 'esmock';
import fse from 'fs-extra';
import sinon from 'sinon';
import os from 'os';

describe('update', function() {
	let needsUpdate;
	let updateLabels;
	let updateGameParams;
	let update;

	const config = {
		wowsdir: '/wows'
	};
	const paths = {
		config: '/config',
		data: '/data',
		temp: '/tmp',
		base: '/'
	}

	let execa;

	beforeEach(async function() {
		execa = sinon.stub().resolves();
		// Do a dynamic import with a dynamic query parameter to cache-bust
		// This is so we can get a fresh import for each test, as the module
		// stores the contents of preferences.xml after the first read.		
		({ needsUpdate, updateLabels, updateGameParams, update } = await esmock('../../src/init/update.js', {}, {
			execa: { execa },
			'../../src/init/config.js': {
				default: config,
				paths
			}
		}));
	});

	afterEach(function() {
		mockfs.restore();
		execa.reset();
	});

	describe('.needsUpdate', function() {		
		function fakeCurrent(version) {
			return {
				[`${config.wowsdir}/bin/${version}`]: {}
			}
		}
		function fakeRemembered(version) {
			return {
				[paths.data]: {
					'.version': version
				}				
			}
		}

		it('should return true when the remembered version is lower than the current detected one', function() {
			const currentVersion = '2';
			const rememberedVersion = '1';
			mockfs({
				...fakeCurrent(currentVersion),
				...fakeRemembered(rememberedVersion)
			});
			return expect(needsUpdate()).to.eventually.be.true;
		});

		it('should return false when the remembered version is equal to the current detected one', function() {
			const currentVersion = '2';
			const rememberedVersion = '2';
			mockfs({
				...fakeCurrent(currentVersion),
				...fakeRemembered(rememberedVersion)
			});			
			return expect(needsUpdate()).to.eventually.be.false;			
		});

		it('should return true if the remembered version is unknown', function() {
			const currentVersion = '1';
			mockfs({
				...fakeCurrent(currentVersion),
				// No remembered version
			});
			return expect(needsUpdate()).to.eventually.be.true;
		});

		it('should return true when the update-policy config option is set to "force"', function() {
			const currentVersion = '1';
			const rememberedVersion = '1';
			mockfs({
				...fakeCurrent(currentVersion),
				...fakeRemembered(rememberedVersion)
			});
			config.updatePolicy = 'force';
			return expect(needsUpdate()).to.eventually.be.true;
		});

		it('should return false when the update-policy config option is set to "prohibit"', function() {
			const currentVersion = '2';
			const rememberedVersion = '1';
			mockfs({
				...fakeCurrent(currentVersion),
				...fakeRemembered(rememberedVersion)
			});
			config.updatePolicy = 'prohibit';
			return expect(needsUpdate()).to.eventually.be.false;
		});
	});

	describe('updateLabels', function() {
		const buildno = '1';

		// Can't pre-polulate mock filesystem directly here, because subsequent calls overwrite
		// instead of adding. I.e. if we did mockfs({[config.wowsdir]: {...}}) here, the subsequent
		// call in the test cases would cause mockfs to drop preferences.xml
		let prepopulated;
		before(function() {
			prepopulated = {
				[path.join(config.wowsdir, 'bin', buildno)]: {},
				[paths.data]: {},
				[paths.config]: {}
			};
		});

		it('should turn labels from the game directory into global-en.json', async function() {		
			const expected = {
				'': 'Content-Type: text/plain; charset=utf-8\nPlural-Forms: nplurals=2; plural=n != 1;\n',
				IDS_1: 'str1'			
			}
			mockfs({
				...prepopulated,
				[path.join(config.wowsdir, `/bin/${buildno}/res/texts/en/LC_MESSAGES/global.mo`)]: mockfs.load('test/init/testdata/global.mo'),
			});
			expect(await updateLabels(buildno)).to.be.true;
			expect(path.join(paths.data, 'global-en.json')).to.be.a.file().with.contents(JSON.stringify(expected));
		});

		it('should revert labels to their previous version if the label update fails', async function() {
			mockfs({
				...prepopulated,
				[path.join(paths.data, 'global-en.json')]: 'preexisting',
				[path.join(config.wowsdir, `/bin/${buildno}/res/texts/en/LC_MESSAGES/global.mo`)]: 'malformed',
			});
			expect(await updateLabels(buildno)).to.be.false;
			expect(path.join(paths.data, 'global-en.json')).to.be.a.file().with.contents('preexisting');
		});
	});

	describe('updateGameParams', function() {
		const buildno = '1';
		let dirs;

		before(function() {
			dirs = {
				[paths.data]: {},
				[paths.config]: {},
				[paths.temp]: {}			
			}
		});

		it('should call wowsunpack.exe to extract GameParams.data', async function() {
			const checker = {
				wowsunpack: {
					cmd: function(cmd) {						
						return /wowsunpack.exe/i.test(cmd)
							&& (os.type() === 'Linux' ? /wine/i.test(cmd) : true)
					},
					args: function(args) {
						args = Array.from(args);
						return args.some(arg => /extract/i.test(arg))
							&& args.some(arg => /packages/i.test(arg) && new RegExp(path.join(config.wowsdir, 'res_packages')).test(arg))
							&& args.some(arg => /output/i.test(arg) && new RegExp(paths.temp).test(arg))
							&& args.some(arg => /include/i.test(arg) && /content\/GameParams.data/.test(arg));
					}
				},
			}
			mockfs({
				[path.join(paths.data, 'GameParams.json')]: '',
				...dirs
			});

			await updateGameParams(buildno);			
			
			// Check commands and arguments of the execa calls
			expect(execa, 'called wowsunpack.exe').to
				.have.been.calledWith(sinon.match(checker.wowsunpack.cmd), sinon.match(checker.wowsunpack.args));
		});
		
		it('should call OneFileToRuleThemAll.py to turn extracted GameParams.data into GameParams.json', async function() {
			const checker = {
				gameparams2json: {
					cmd: function(cmd) {
						return /python/i.test(cmd) && /OneFileToRuleThemAll.py/.test(cmd);
					},
				}
			}
			mockfs({
				[path.join(paths.data, 'GameParams.json')]: '',
				...dirs
			});

			await updateGameParams(buildno);			
			
			// Check commands and arguments of the execa calls
			expect(execa, 'called OneFileToRuleThemAll.py').to
				.have.been.calledWith(sinon.match(checker.gameparams2json.cmd));			
		});

		it('should copy converted data to the data directory', async function() {
			const gamedata = 'game data';
			mockfs({
				[path.join(paths.data, 'GameParams.json')]: '',
				...dirs
			});
			// First call is a dummy call
			execa.onFirstCall().resolves();
			// Second call creates an "extracted" and "converted" GameParams-0.json
			execa.onSecondCall().callsFake(function() {
				fse.mkdirSync(path.join(paths.temp, 'content'));
				fse.writeFileSync(path.join(paths.temp, 'content/GameParams-0.json'), gamedata);
			}).resolves();

			expect(await updateGameParams(buildno)).to.be.true;			
			expect(path.join(paths.data, 'GameParams.json')).to.be.a.file().with.contents(gamedata);
		});

		it('should revert game data to its previous version if the game data update fails', async function() {
			const gamedata = 'game data';
			mockfs({
				[path.join(paths.data, 'GameParams.json')]: gamedata,
				...dirs
			});

			execa.rejects();
			expect(await updateGameParams(buildno)).to.be.false;
			expect(path.join(paths.data, 'GameParams.json')).to.be.a.file().with.contents(gamedata);
		});
	});

	describe('update', function() {
		const buildno = '1';
		beforeEach(function() {
			mockfs({
				[path.join(config.wowsdir, `bin/${buildno}/res/texts/en/LC_MESSAGES/global.mo`)]: mockfs.load('test/init/testdata/global.mo'),
			});
		});

		it('should create the data folder if it is not present', async function() {
			await update();
			expect(paths.data).to.be.a.directory();
		});

		it('should write the new version to disk after a successful update', async function() {
			await fse.ensureDir(paths.data);
			await fse.ensureFile(path.join(paths.temp, 'content/GameParams-0.json'));
			await update();
			expect(path.join(paths.data, '.version')).to.be.a.file().with.contents(buildno);
		});

		it('should not change the remembered version after an unsuccessful update', async function() {
			await fse.ensureDir(paths.data);
			execa.rejects();
			await update();
			expect(path.join(paths.data, '.version')).to.not.be.a.path();
		});
	});
});