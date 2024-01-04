import clone from 'lodash/cloneDeep.js';
import Armament from '../../src/model/modules/armament.js';
import Gun from '../../src/model/gun.js';
import Shell from '../../src/model/shell.js';

describe('Armament', function() {
	const TEST_DATA = {
		gun1: { numBarrels: 1, shotDelay: 10 },
		gun2: { numBarrels: 2, shotDelay: 10 }
	}
	let armament;
	let guns;

	beforeEach(function() {
		const data = clone(TEST_DATA);			
		data.gun1 = new Gun(data.gun1);
		data.gun2 = new Gun(data.gun2);		
		armament = new Armament(null, data);
		guns = [ data.gun1, data.gun2 ];
	});

	it('should have a property mounts with all gun mounts', function() {
		expect(armament.mounts).to.exist;
		expect(armament.mounts.map(gun => gun._data)).to.deep.equal([ TEST_DATA.gun1, TEST_DATA.gun2 ]);
	});

	it('should have a property dpm with the aggregate dpm output of all mounts', function() {
		const shells = ['he','sap','ap'].map((ammoType,index) => ({ ammoType, alphaDamage: 1000 * (index + 1) }));
		guns.forEach(gun => gun._data.ammoList = shells.map(shell => new Shell(shell)));
		
		[ 'he', 'sap', 'ap' ].forEach(ammoType => {
			const dpm = guns.reduce((prev, curr) => prev + curr.dpm[ammoType], 0);
			expect(armament.dpm).to.have.property(ammoType).that.equals(dpm);
		});
	});
});