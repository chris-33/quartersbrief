import ShipBuilder from '../../src/util/shipbuilder.js';
import Ship from '../../src/model/ship.js';
import GameObjectProvider from '../../src/providers/gameobjectprovider.js';
import sinon from 'sinon';

describe('ShipBuilder', function() {
	describe('.build', function() {
		let shipBuilder;
		let ship;

		beforeEach(function() {
			shipBuilder = new ShipBuilder(new GameObjectProvider());
			sinon.stub(shipBuilder.gameObjectProvider, 'createGameObject');

			ship = new Ship({ ShipUpgradeInfo: {} });
		});

		it('should create a ship from the build if none was passed', async function() {
			shipBuilder.gameObjectProvider.createGameObject.resolves(ship);
			return expect(shipBuilder.build({ ship: 'PAAA001' })).to.eventually.exist;
		});

		it('should use the passed ship if it is a Ship instance, create it if ship was passed as a reference name, reference code or id', async function() {
			shipBuilder.gameObjectProvider.createGameObject.resolves(ship);

			expect(await shipBuilder.build(ship, {})).to.equal(ship);
			expect(shipBuilder.gameObjectProvider.createGameObject).to.not.have.been.called;
			await shipBuilder.build('PAAA001', {});
			expect(shipBuilder.gameObjectProvider.createGameObject).to.have.been.calledWith('PAAA001');
			await shipBuilder.build('PAAA001_Battleship', {});
			expect(shipBuilder.gameObjectProvider.createGameObject).to.have.been.calledWith('PAAA001_Battleship');
			await shipBuilder.build(1, {});
			expect(shipBuilder.gameObjectProvider.createGameObject).to.have.been.calledWith(1);
		});

		it('should equip the specified module configuration of the build', async function() {
			const configuration = { modules: 'testconfiguration' };
			sinon.stub(ship, 'equipModules');

			await shipBuilder.build(ship, configuration);
			expect(ship.equipModules).to.have.been.calledWith(configuration.modules);
		});

		it('should equip all modernizations of the build', async function() {
			sinon.stub(ship, 'equipModernization');
			const build = {
				modernizations: [ 'PCM001', 'PCM002' ]
			};
			const expected = {
				'PCM001': {}, 
				'PCM002': {}
			}
			shipBuilder.gameObjectProvider.createGameObject
				.withArgs('PCM001').resolves(expected.PCM001)
				.withArgs('PCM002').resolves(expected.PCM002);

			await shipBuilder.build(ship, build);
			build.modernizations.forEach(async modernization => {
				expect(shipBuilder.gameObjectProvider.createGameObject).to.have.been.calledWith(modernization);
				expect(ship.equipModernization).to.have.been.calledWith(expected[modernization]);
			});
		});

		it('should set the camouflage of the build', async function() {
			sinon.stub(ship, 'setCamouflage');
			const build = {
				camouflage: 'PAEP001'
			};
			const expected = {};
			shipBuilder.gameObjectProvider.createGameObject.withArgs(build.camouflage).resolves(expected);

			await shipBuilder.build(ship, build);
			expect(shipBuilder.gameObjectProvider.createGameObject).to.have.been.calledWith(build.camouflage);
			expect(ship.setCamouflage).to.have.been.calledWith(expected);
		});

		it('should hoist all signals of the build', async function() {
			sinon.stub(ship, 'hoist');
			const build = {
				signals: [ 'PCE001', 'PCE002' ]
			};
			const expected = {
				'PCE001': {},
				'PCE002': {}
			}			
			shipBuilder.gameObjectProvider.createGameObject
				.withArgs('PCE001').resolves(expected.PCE001)
				.withArgs('PCE002').resolves(expected.PCE002);

			await shipBuilder.build(ship, build);
			build.signals.forEach(async signal => {
				expect(shipBuilder.gameObjectProvider.createGameObject).to.have.been.calledWith(signal);				
				expect(ship.hoist).to.have.been.calledWith(expected[signal]);
			});
		});

		it('should set the captain of the build', async function() {
			const build = {
				captain: 'PAW001'
			};
			const expected = {};
			shipBuilder.gameObjectProvider.createGameObject.withArgs('PAW001').resolves(expected);
			sinon.stub(ship, 'setCaptain');

			await shipBuilder.build(ship, build);
			expect(shipBuilder.gameObjectProvider.createGameObject).to.have.been.calledWith(build.captain);
			expect(ship.setCaptain).to.have.been.calledWith(expected);
		});

		it('should learn the specified skills for the captain', async function() {
			// Fake captain to be returned by the GameObjectProvider when the default captain is requested
			let captain = {
				learn: sinon.stub()
			}
			// Make createGameObject return the fake captain when requested
			shipBuilder.gameObjectProvider.createGameObject
				.withArgs(ShipBuilder.DEFAULT_CAPTAIN)
				.resolves(captain);			
			sinon.stub(ship, 'setCaptain');
			
			const build = {
				skills: [ 1, 2 ]
			}

			await shipBuilder.build(ship, build);
			expect(ship.setCaptain).to.have.been.calledWith(captain);
			build.skills.forEach(skill => expect(captain.learn).to.have.been.calledWith(skill));
		});
	});
});