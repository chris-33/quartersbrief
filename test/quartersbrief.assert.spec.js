var assertInvariants = require('$/src/quartersbrief.assert');
var sinon = require('sinon');

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
			'assertUpgradeComponentsResolveUnambiguously'
		].map(name => sinon.stub(assertInvariants, name));

		// Need to explicitly do this because sinon-test seems to not be 
		// picking up on our stubs
		try {
			assertInvariants(data);
			for (assertion of assertions)
				expect(assertion).to.have.been.calledWith(data);
		} finally {
			for (assertion of assertions)
			assertions.forEach(assertion => assertion.restore());
		}
	});

	it('should collect all InvariantErrors and throw them as an AggregateError at the end', sinon.test(function() {
		let data = {};
		let assertions = [
			'assertHaveIDs',
			'assertHaveIndices',
			'assertHaveNames',
			'assertUpgradeComponentsResolveUnambiguously'
		].map(name => sinon.stub(assertInvariants, name).throws(new assertInvariants.InvariantError()));

		// Need to explicitly do this because sinon-test seems to not be 
		// picking up on our stubs
		try {
			expect( () => assertInvariants(data)).to.throw(AggregateError);
		} finally {
			assertions.forEach(assertion => assertion.restore());
		}
	}));
});