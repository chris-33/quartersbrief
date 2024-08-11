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

	describe('.shoot', function() {
		beforeEach(function() {
			gun = new Gun({
				...GUN,
				// Values from USS Iowa as per 0.12.9
				delim: 0.5,
				idealDistance: 1000,
				idealRadius: 12,
				minRadius: 2,
				radiusOnDelim: 0.5,
				radiusOnMax: 0.6,
				radiusOnZero: 0.2,
				maxDist: 21227,
				taperDist: 5000,
				sigmaCount: 1.5
			});
		});

		it('should replicate known dispersion-by-range values', function() {
			const expected = [
				// Values taken from World of Warships ShipBuilder for USS Iowa
				// https://app.wowssb.com/charts
				{ dist: 0, horizontal: 0, vertical: 0 },
				{ dist: 2500, horizontal: 55, vertical: 14.89 },
				{ dist: 5000, horizontal: 110, vertical: 37.54 },
				{ dist: 10000, horizontal: 160, vertical: 77.22 },
				{ dist: 15000, horizontal: 210, vertical: 113.67 },
				{ dist: 20000, horizontal: 260, vertical: 152.99 },
				{ dist: gun.maxRange, horizontal: 272.27, vertical: 163.36 },
			]
			
			for (let { dist, horizontal, vertical } of expected) {
				const { dispersion } = gun.shoot(dist);
				expect(dispersion[0], `horizontal @${dist}m`).to.be.approximately(horizontal, 0.01);
				expect(dispersion[1], `vertical @${dist}m`).to.be.approximately(vertical, 0.01);
			}
		});

		it('should replicate ships\' known maximum dispersion values', function() {
			const GUNS = [
				// Iowa, see beforeEach
				gun,
				// Yamato v0.12.9
				new Gun({ numBarrels: 3, shotDelay: 30, delim: 0.5, idealDistance: 1000, idealRadius: 10, minRadius: 2.8, radiusOnDelim: 0.6, radiusOnMax: 0.8, radiusOnZero: 0.2, maxDist: 26630, taperDist: 5000, sigmaCount: 2.1 })
			]
			const expected = [
				[ 272.27, 163.36 ],
				[ 275.74, 220.59 ]
			]

			for (let i = 0; i < GUNS.length; i++) {
				const gun = GUNS[i];
				const shot = gun.shoot(gun.maxRange);
				expect(shot.dispersion).to.be.an('array').with.lengthOf(2);
				// Only check for approximate equality because our reference values are not super accurate
				expect(shot.dispersion[0]).to.be.approximately(expected[i][0], 0.01);
				expect(shot.dispersion[1]).to.be.approximately(expected[i][1], 0.01);
			}
		});

		// Tests the implementation of the expected miss distance formulas.
		// It does NOT test the correctness of the formulas themselves, as there is no independently obtained
		// data to compare to.
		it('should have expected horizontal and vertical miss distances', function() {
			const RANGE = 20000;
			// Expected miss distances as calculated by hand
			const expected = [ 110.770429704891, 65.1816687877631 ]
			const missDistance = gun.shoot(RANGE).expectedMissDistance;

			expect(missDistance).to.be.an('array').with.lengthOf(2);
			expect(missDistance[0], 'horizontal').to.be.approximately(expected[0], 1e-4);
			expect(missDistance[1], 'vertical').to.be.approximately(expected[1], 1e-4);
		});

		it('should be undefined beyond max range', function() {
			expect(gun.shoot(gun.maxRange + 1)).to.not.exist;
		});
	});
});