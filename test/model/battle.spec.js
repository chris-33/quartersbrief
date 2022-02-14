import { Battle } from '../../src/model/battle.js';
import { GameObjectFactory } from '../../src/model/gameobjectfactory.js';
import { readFileSync } from 'fs';
import sinon from 'sinon';

describe('Battle', function() {
	let TEST_DATA;
	let battle;

	before(function() {
		TEST_DATA = JSON.parse(readFileSync('test/model/testdata/battle.json'));
	});

	beforeEach(function() {
		let gameObjectFactory = new GameObjectFactory({});
		sinon.stub(gameObjectFactory, 'createGameObject').returns({});
		battle = new Battle(TEST_DATA, gameObjectFactory);
	});

	afterEach(function() {
		battle.gameObjectFactory.createGameObject.restore();
	});

	it('should have a ship for all vehicles', function() {
		for (let vehicle of TEST_DATA.vehicles)
			expect(battle.gameObjectFactory.createGameObject).to.have.been.calledWith(vehicle.shipId);
	});		

	describe('.getPlayer', function() {
		it('should return the vehicle with the player ID', function() {
			expect(battle.getPlayer()).to.deep.equal(TEST_DATA.vehicles[7]);
		});

	});

	describe('.getAllies', function() {
		it('should return all vehicles with relation 1', function() {
			let expected = TEST_DATA.vehicles.filter(vehicle => vehicle.relation === 1);
			expect(battle.getAllies()).to.be.an('array').with.deep.members(expected);
		});
	});


	describe('.getEnemies', function() {
		it('should return all vehicles with relation 2', function() {
			let expected = TEST_DATA.vehicles.filter(vehicle => vehicle.relation === 2);
			expect(battle.getEnemies()).to.be.an('array').with.deep.members(expected);
		});
	});
});