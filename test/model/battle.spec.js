import Battle from '../../src/model/battle.js';

describe('Battle', function() {
	const VEHICLES = [
		{ shipId: 1, relation: 1, id: 1, name: 'ally1' }, 
		{ shipId: 2, relation: 2, id: 2, name: 'enemy1' }, 
		{ shipId: 3, relation: 1, id: 3, name: 'ally2' }, 
		{ shipId: 4, relation: 1, id: 4, name: 'ally3' }, 
		{ shipId: 5, relation: 2, id: 5, name: 'enemy2' }, 
		{ shipId: 6, relation: 2, id: 6, name: 'enemy3' }, 
		{ shipId: 7, relation: 2, id: 7, name: 'enemy4' }, 
		{ shipId: 8, relation: 0, id: 8, name: 'player' }
	]
	let battle;

	beforeEach(function() {
		battle = new Battle({ vehicles: VEHICLES });
	});

	describe('.player', function() {
		it('should be the vehicle with relation playerID', function() {
			battle = new Battle({ playerID: 0, vehicles: VEHICLES });
			
			expect(battle.player).to.deep.equal(VEHICLES[7]);
		});

	});

	describe('.allies', function() {
		it('should be an array of all vehicles with relation 1', function() {
			expect(battle.allies).to.be.an('array').with.deep.members(VEHICLES.filter(vehicle => vehicle.relation === 1));
		});
	});


	describe('.enemies', function() {
		it('should return all vehicles with relation 2', function() {
			expect(battle.enemies).to.be.an('array').with.deep.members(VEHICLES.filter(vehicle => vehicle.relation === 2));
		});
	});
});