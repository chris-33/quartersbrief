import Shell from '../../src/model/shell.js';

describe('Shell', function() {
	it('should have property ammoType===\'sap\' on SAP shells', function() {
		// Wargaming calls SAP CS in the game files, make sure that is replaced in the Shell
		const shell = new Shell({
			ammoType: 'CS'
		});

		expect(shell).to.have.property('ammoType').that.equals('sap');
	});

	it('should have property pen for HE and SAP shells', function() {
		[ 'HE', 'CS' ].forEach((ammoType, index) => {
			const expected = 30 * (index + 1);
			const shell = new Shell({
				ammoType,
				[`alphaPiercing${ammoType}`]: expected
			});

			expect(shell).to.have.property('pen').that.equals(expected);
		});
	});
});