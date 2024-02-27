import Gun from '../../src/model/gun.js';
import Shell from '../../src/model/shell.js';
import Torpedo from '../../src/model/torpedo.js';

describe('Gun', function() {
	let gun;
	// eslint-disable-next-line mocha/no-setup-in-describe
	const SHELLS = [ 'he','sap','ap' ].map((ammoType, index) => ({ ammoType, alphaDamage: 1000 * (index + 1) }));
	const GUN = {
		numBarrels: 3,
		shotDelay: 10
	};

	beforeEach(function() {
		gun = new Gun({ 
			...GUN,
			ammoList: SHELLS.map(shell => new Shell(shell)) 
		});
	});

	describe('.ammos property', function() {
		it('should be a hash from ammo type to projectile for all ammos', function() {		
			expect(gun).to.have.property('ammos').that.is.an('object');
			[ 'he', 'sap', 'ap' ].forEach(ammoType => {
				expect(gun.ammos).to.have.property(ammoType).that.is.an.instanceOf(Shell);
				expect(gun.ammos[ammoType]._data).to.deep.equal(SHELLS.find(shell => shell.ammoType === ammoType));
			});
		});

		it('should be a hash from projectile name to projectile for ammos that have no ammo type', function() {		
			const AMMO_NAMES = [ 'Projectile1', 'Projectile2' ];
			const TORPEDOES = AMMO_NAMES.map(ammoName => ({
				alphaDamage: 1000,
				name: ammoName
			}));
			gun = new Gun({ ...GUN, ammoList: TORPEDOES.map(torpedo => new Torpedo(torpedo)) });

			expect(gun).to.have.property('ammos').that.is.an('object');		
			AMMO_NAMES.forEach(ammoName => {
				expect(gun.ammos).to.have.property(ammoName).that.is.an.instanceOf(Torpedo);
				expect(gun.ammos[ammoName]._data).to.deep.equal(TORPEDOES.find(torpedo => torpedo.name === ammoName));
			});
		});
	});

	it('should have property dpm with dpm for the gun', function() {
		expect(gun).to.have.property('dpm').that.is.an('object');
		[ 'he', 'sap', 'ap' ].forEach(ammoType => {
			const dpm = GUN.numBarrels * 60 / GUN.shotDelay * SHELLS.find(shell => shell.ammoType === ammoType).alphaDamage;
			expect(gun.dpm).to.have.property(ammoType).that.equals(dpm);
		});
	});
});