import { ShipBuilder } from '../../src/util/shipbuilder.js';
import { Ship } from '../../src/model/ship.js';
import { GameObjectFactory } from '../../src/model/gameobjectfactory.js';
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
			try {
				shipBuilder.build(ship, {
					modernizations: [ 'PCM001', 'PCM002' ]
				});
				expect(shipBuilder.gameObjectFactory.createGameObject).to.have.been.calledWith('PCM001');
				expect(ship.equipModernization).to.have.been.calledWith(shipBuilder.gameObjectFactory.createGameObject.firstCall.returnValue);
				expect(shipBuilder.gameObjectFactory.createGameObject).to.have.been.calledWith('PCM002');
				expect(ship.equipModernization).to.have.been.calledWith(shipBuilder.gameObjectFactory.createGameObject.secondCall.returnValue);
			} finally { ship.equipModernization.restore(); }
		});

		it('should set the camouflage of the build', function() {
			sinon.stub(ship, 'setCamouflage');
			try {
				shipBuilder.build(ship, {
					camouflage: 'PAEP001'
				});
				expect(shipBuilder.gameObjectFactory.createGameObject).to.have.been.calledWith('PAEP001');
				expect(ship.setCamouflage).to.have.been.calledWith(shipBuilder.gameObjectFactory.createGameObject.firstCall.returnValue);
			} finally { ship.setCamouflage.restore(); }
		});


	})
});