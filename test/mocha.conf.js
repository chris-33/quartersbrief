import chai from 'chai';
import sinon from 'sinon';
import sinontest from 'sinon-test';
import sinonchai from 'sinon-chai';
import chaiaspromised from 'chai-as-promised';
import chaievents from 'chai-events';
import log from 'loglevel';
import { ComplexDataObject } from '../src/util/cdo.js';
import util from 'util';

sinon.test = sinontest(sinon);

chai.use(sinonchai);
chai.use(chaiaspromised);
chai.use(chaievents);

// Add a new chain property .cdo and modifies .equal such that
// expect(cdo).to.cdo.equal(other) is true iff:
// - cdo and other are both instances of ComplexDataObject
// - cdo.equals(other) === true
chai.use(function(_chai, utils) {
	const Assertion = _chai.Assertion;

	Assertion.addProperty('cdo', function() {
		utils.flag(this, 'cdo', true);
		this.assert(
			this._obj instanceof ComplexDataObject,
			'expected #{this} to be a ComplexDataObject',
			'expected #{this} to not be ComplexDataObject'
			);
	});

	Assertion.overwriteMethod('equal', function(_super) {
		return function(other) {
			if (utils.flag(this, 'cdo')) {
				let cdo = this._obj;
				if (!(other instanceof ComplexDataObject))
					other = new ComplexDataObject(other);
				this.assert(
					cdo.equals(other),
					'expected ComplexDataObjects to be equal',
					'expected ComplexDataObjects to not be equal',
					util.inspect(other),
					util.inspect(cdo)
				);
			}
			else
				_super.apply(this, arguments);
		}
	});

	Assertion.overwriteMethod('members', function(_super) {
		return function(other) {
			if (utils.flag(this, 'cdo')) {
				console.log('CdO')
				let cdo = this._obj;
				if (!(other instanceof ComplexDataObject))
					other = new ComplexDataObject(other);
				this.assert(
					cdo.every(item => other.some(otherItem => item.equals(otherItem))),
					'expected ComplexDataObjects to be equal',
					'expected ComplexDataObjects to not be equal',
					util.inspect(other),
					util.inspect(cdo)
				);
			}
			else
				_super.apply(this, arguments);
		}
	});

});

global.expect = chai.expect;

// Prevent log output from polluting test report
log.disableAll();