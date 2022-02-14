import chai from 'chai';
import sinon from 'sinon';
import sinontest from 'sinon-test';
import sinonchai from 'sinon-chai';
import chaiaspromised from 'chai-as-promised';

sinon.test = sinontest(sinon);

chai.use(sinonchai);
chai.use(chaiaspromised);

global.expect = chai.expect;