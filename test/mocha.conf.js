import chai from 'chai';
import sinon from 'sinon';
import sinontest from 'sinon-test';
import sinonchai from 'sinon-chai';

sinon.test = sinontest(sinon);

chai.use(sinonchai);

global.expect = chai.expect;