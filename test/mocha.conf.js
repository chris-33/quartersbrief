var chai = require('chai');
var sinon = require('sinon');

sinon.test = require('sinon-test')(sinon);

chai.use(require('sinon-chai'));

global.expect = chai.expect;