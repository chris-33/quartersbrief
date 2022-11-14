import ShipBuilder from '../../src/util/shipbuilder.js';
import Ship from '../../src/model/ship.js';
import GameObjectFactory from '../../src/model/gameobjectfactory.js';
import sinon from 'sinon';

describe('ShipBuilder', function() {
	describe('.build', function() {
		let shipBuilder;
		let ship;

		beforeEach(function() {
			shipBuilder = new ShipBuilder(new GameObjectFactory({}));
			sinon.stub(shipBuilder.gameObjectFactory, 'createGameObject').returnsArg(0);

			ship = new Ship({ ShipUpgradeInfo: {} });
		});

		afterEach(function() {
			shipBuilder.gameObjectFactory.createGameObject.restore();
		});

		it('should create a ship from the build if none was passed', function() {
			shipBuilder.gameObjectFactory.createGameObject.resetBehavior();
			shipBuilder.gameObjectFactory.createGameObject.returns(ship);
			expect(shipBuilder.build({ ship: 'PAAA001' })).to.exist;
		});

		it('should use the passed ship if it is a Ship instance, create it if ship was passed as a reference name, reference code or id', function() {
			shipBuilder.gameObjectFactory.createGameObject.resetBehavior();
			shipBuilder.gameObjectFactory.createGameObject.returns(ship);
			expect(shipBuilder.build(ship, {})).to.equal(ship);
			expect(shipBuilder.gameObjectFactory.createGameObject).to.not.have.been.called;
			shipBuilder.build('PAAA001', {});
			expect(shipBuilder.gameObjectFactory.createGameObject).to.have.been.calledWith('PAAA001');
			shipBuilder.build('PAAA001_Battleship', {});
			expect(shipBuilder.gameObjectFactory.createGameObject).to.have.been.calledWith('PAAA001_Battleship');
			shipBuilder.build(1, {});
			expect(shipBuilder.gameObjectFactory.createGameObject).to.have.been.calledWith(1);
		});

		it('should equip the specified module configuration of the build', function() {
			sinon.stub(ship, 'equipModules');
			try {
				shipBuilder.build(ship, { modules: 'testconfiguration' });
				expect(ship.equipModules).to.have.been.calledWith('testconfiguration');
			} finally { ship.equipModules.restore(); }
		});

		it('should equip all modernizations of the build', function() {
			sinon.stub(ship, 'equipModernization');
			const build = {
				modernizations: [ 'PCM001', 'PCM002' ]
			};

			try {
				shipBuilder.build(ship, build);
				build.modernizations.forEach((modernization, index) => {
					expect(shipBuilder.gameObjectFactory.createGameObject).to.have.been.calledWith(modernization);
					expect(ship.equipModernization).to.have.been.calledWith(shipBuilder.gameObjectFactory.createGameObject.getCall(index).returnValue);					
				});
			} finally { ship.equipModernization.restore(); }
		});

		it('should set the camouflage of the build', function() {
			sinon.stub(ship, 'setCamouflage');
			const build = {
				camouflage: 'PAEP001'
			};
			try {
				shipBuilder.build(ship, build);
				expect(shipBuilder.gameObjectFactory.createGameObject).to.have.been.calledWith(build.camouflage);
				expect(ship.setCamouflage).to.have.been.calledWith(shipBuilder.gameObjectFactory.createGameObject.firstCall.returnValue);
			} finally { ship.setCamouflage.restore(); }
		});

		it('should hoist all signals of the build', function() {
			sinon.stub(ship, 'hoist');
			const build = {
				signals: [ 'PCE001', 'PCE002' ]
			};

			try {
				shipBuilder.build(ship, build);
				build.signals.forEach((signal, index) => {
					expect(shipBuilder.gameObjectFactory.createGameObject).to.have.been.calledWith(signal);
					expect(ship.hoist).to.have.been.calledWith(shipBuilder.gameObjectFactory.createGameObject.getCall(index).returnValue);
				});
			} finally { ship.hoist.restore(); }
		});

		it('should set the captain of the build', function() {
			const build = {
				captain: 'PAW001'
			};
			sinon.stub(ship, 'setCaptain');
			try {
				shipBuilder.build(ship, build);
				expect(shipBuilder.gameObjectFactory.createGameObject).to.have.been.calledWith(build.captain);
				expect(ship.setCaptain).to.have.been.calledWith(shipBuilder.gameObjectFactory.createGameObject.firstCall.returnValue);
			} finally { ship.setCaptain.restore(); }
		});

		it('should learn the specified skills for the captain', function() {
			// Fake captain to be returned by the GameObjectFactory when the default captain is requested
			let captain = {
				learn: sinon.stub()
			}
			// Make createGameObject return the fake captain when requested
			shipBuilder.gameObjectFactory.createGameObject
				.withArgs(ShipBuilder.DEFAULT_CAPTAIN)
				.returns(captain);			
			sinon.stub(ship, 'setCaptain');
			
			const build = {
				skills: [ 1, 2 ]
			}

			try {
				shipBuilder.build(ship, build);
				expect(ship.setCaptain).to.have.been.calledWith(captain);
				build.skills.forEach(skill => expect(captain.learn).to.have.been.calledWith(skill));
			} finally { ship.setCaptain.restore(); }
		});
	});
});