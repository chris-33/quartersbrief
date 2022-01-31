const assertInvariants = require('$/src/quartersbrief.assert');
const sinon = require('sinon');
const clone = require('$/src/util/util').clone;

const TEST_DATA = require('$/test/quartersbrief.assert.spec.json');

describe('assertInvariants', function() {	
	it('should expose InvariantError', function() {
		expect(assertInvariants).to.have.property('InvariantError');
		expect(new assertInvariants.InvariantError()).to.be.an.instanceof(Error);
	});

	it('should call all its assertion functions with its data', function() {
		let data = {};
		let assertions = [
			'assertHaveIDs',
			'assertHaveIndices',
			'assertHaveNames',
			'assertModuleComponentsResolveUnambiguously'
		].map(name => sinon.stub(assertInvariants, name));

		// Need to explicitly do this because sinon-test seems to not be 
		// picking up on our stubs
		try {
			assertInvariants(data);
			for (let assertion of assertions)
				expect(assertion).to.have.been.calledWith(data);
		} finally {
			assertions.forEach(assertion => assertion.restore());
		}
	});

	it('should collect all InvariantErrors and throw them as an AggregateError at the end', function() {
		let data = {};
		let assertions = [
			'assertHaveIDs',
			'assertHaveIndices',
			'assertHaveNames',
			'assertModuleComponentsResolveUnambiguously'
		].map(name => sinon.stub(assertInvariants, name).throws(new assertInvariants.InvariantError()));

		// Need to explicitly do this because sinon-test seems to not be 
		// picking up on our stubs
		try {
			expect(assertInvariants.bind(null, data)).to.throw(AggregateError);
		} finally {
			assertions.forEach(assertion => assertion.restore());
		}
	});

	describe('.assertHaveIDs', function() {
		let data;

		beforeEach(function() {
			data = clone(TEST_DATA);
		});

		it('should not error on data that has a numeric ID', function() {			
			expect(assertInvariants.assertHaveIDs.bind(null, data)).to.not.throw();
		});

		it('should throw an InvariantError if ID is not numeric', function() {
			data.PAAA001_Battleship.id = 'string';
			expect(assertInvariants.assertHaveIDs.bind(null, data)).to.throw(assertInvariants.InvariantError);
		});

		it('should throw an InvariantError if ID is not present at all', function() {
			delete data.PAAA001_Battleship.id;
			expect(assertInvariants.assertHaveIDs.bind(null, data)).to.throw(assertInvariants.InvariantError);
		});
	});

	describe('.assertHaveIndices', function() {
		let data;

		beforeEach(function() {
			data = clone(TEST_DATA);
		});

		it('should not error on data that has a well-formed index', function() {
			expect(assertInvariants.assertHaveIndices.bind(null, data)).to.not.throw();
		});

		it('should throw an InvariantError if index does not conform to the regex', function() {
			data.PAAA001_Battleship.index = 'ABCDEFG';
			expect(assertInvariants.assertHaveIndices.bind(null, data)).to.throw(assertInvariants.InvariantError);
		});

		it('should throw an InvariantError if index is not present at all', function() {
			delete data.PAAA001_Battleship.index;
			expect(assertInvariants.assertHaveIndices.bind(null, data)).to.throw(assertInvariants.InvariantError);
		});
	});

	describe('.assertHaveNames', function() {
		let data;

		beforeEach(function() {
			data = clone(TEST_DATA);
		});

		it('should not error on data that has a well-formed name', function() {
			expect(assertInvariants.assertHaveNames.bind(null, data)).to.not.throw();
		});

		it('should throw an InvariantError if name does not conform to the regex', function() {
			let data = clone(TEST_DATA);
			data.PAAA001_Battleship.name = 'ABCDEFG';
			expect(assertInvariants.assertHaveNames.bind(null, data)).to.throw(assertInvariants.InvariantError);
		});

		it('should throw an InvariantError if name is not present at all', function() {
			let data = clone(TEST_DATA);
			delete data.PAAA001_Battleship.name;
			expect(assertInvariants.assertHaveNames.bind(null, data)).to.throw(assertInvariants.InvariantError);
		});
	});

	describe('.assertModuleComponentsResolveUnambiguously', function() {
		let data;

		beforeEach(function() {
			data = clone(TEST_DATA);
		});


		it('should not error if all modules\'s components have length 1', function() {
			expect(assertInvariants.assertModuleComponentsResolveUnambiguously.bind(null, data)).to
				.not.throw();
		});

		it('should throw an InvariantError if there is a component definition of length > 1 without another one to remedy it', function() {
			data.PAAA001_Battleship.ShipUpgradeInfo.A_Hull.components['torpedoes'] = [ 'AB1_Torpedoes', 'AB2_Torpedoes' ];
			expect(assertInvariants.assertModuleComponentsResolveUnambiguously.bind(null, data)).to
				.throw(assertInvariants.InvariantError);
		});

		it('should not error when there is a component with length > 1 but it is remedied by another', function() {
			// This will get remedied by the two Artillery module definitions:
			data.PAAA001_Battleship.ShipUpgradeInfo.A_Hull.components['artillery'] = [ 'AB1_Artillery', 'AB2_Artillery' ];
			expect(assertInvariants.assertModuleComponentsResolveUnambiguously.bind(null, data)).to
				.not.throw();
		});

		it('should not error when there is a component with length > 1 but it is remedied by several others', function() {
			let modules = data.PAAA001_Battleship.ShipUpgradeInfo
			modules.A_Hull.components['artillery'] = [ 'AB1_Artillery', 'AB2_Artillery', 'AB3_Artillery' ];
			modules.AB2_Artillery.components['artillery'] = ['AB2_Artillery', 'AB3_Artillery']
			delete modules['AB1_Artillery'];
			modules.SUO_STOCK.components['artillery'] = [ 'AB1_Artillery', 'AB3_Artillery' ];
			// data now allows
			// on A_Hull: AB1_Artillery, AB2_Artillery, AB3_Artillery
			// on AB2_Artillery: AB2_Artillery, AB3_Artillery
			// AB1_Artillery has been removed
			// on SUO_STOCK: AB1_Artillery, AB3_Artillery
			// This is resolvable to AB3_Artillery by combining all three
			expect(assertInvariants.assertModuleComponentsResolveUnambiguously.bind(null, data)).to
				.not.throw();
		});

		it('should throw an InvariantError when there is a component with length > 1, but the remedy requires two modules of the same type', function() {
			let modules = data.PAAA001_Battleship.ShipUpgradeInfo;
			modules.A_Hull.components['artillery'] = [ 'AB1_Artillery', 'AB2_Artillery', 'AB3_Artillery' ];
			modules.AB1_Artillery.components['artillery'] = [ 'AB1_Artillery', 'AB3_Artillery' ];
			modules.AB2_Artillery.components['artillery'] = [ 'AB2_Artillery', 'AB3_Artillery' ];
			// data now allows
			// on A_Hull: AB1_Artillery, AB2_Artillery, AB3_Artillery
			// on AB1_Artillery: AB1_Artillery, AB3_Artillery
			// on AB2_Artillery: AB2_Artillery, AB3_Artillery
			// This is only resolvable by equipping AB1_Artillery and AB2_Artillery simultaneously,
			// which the algorithm should not allow
			expect(assertInvariants.assertModuleComponentsResolveUnambiguously.bind(null, data)).to
				.throw(assertInvariants.InvariantError);
		});
	});
});