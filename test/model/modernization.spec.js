import { Modernization } from '$/src/model/modernization.js';
import { Ship } from '$/src/model/ship.js';
import { GameObject } from '$/src/model/gameobject.js';
import { readFileSync } from 'fs';

describe('Modernization', function() {
	it('should be a GameObject', function() {
		expect(new GameObject({})).to
			.be.an.instanceof(GameObject);
	});

	describe('.eligible', function() {
		let ship;
		let TEST_DATA;

		before(function() {
			TEST_DATA = JSON.parse(readFileSync('test/model/modernization.spec.json'));
			ship = new Ship(TEST_DATA.SHIPS.T8BB);	
		});

		it('should always find modernizations with slot -1 ineligible', function() {
			expect(new Modernization(TEST_DATA.MODERNIZATIONS.DISABLED).eligible(ship)).to
				.be.false;
		});

		it('should always find whitelisted ships eligible', function() {						
			expect(new Modernization(TEST_DATA.MODERNIZATIONS.WHITELISTED).eligible(ship)).to
				.be.true;
		});

		it('should always find blacklisted ships ineligible', function() {
			expect(new Modernization(TEST_DATA.MODERNIZATIONS.BLACKLISTED).eligible(ship)).to
				.be.false;
		});

		it('should find a ship whose tier, nation and type match eligible', function() {
			expect(new Modernization(TEST_DATA.MODERNIZATIONS.MATCH).eligible(ship)).to
				.be.true;
		});

		it('should find a ship whose tier, nation, or type do not match ineligible', function() {
			expect(new Modernization(TEST_DATA.MODERNIZATIONS.MISMATCH_TIER).eligible(ship)).to
				.be.false;
			expect(new Modernization(TEST_DATA.MODERNIZATIONS.MISMATCH_NATION).eligible(ship)).to
				.be.false;
			expect(new Modernization(TEST_DATA.MODERNIZATIONS.MISMATCH_TYPE).eligible(ship)).to
				.be.false;
		});
	});
});
