import chai from 'chai';
import sinon from 'sinon';
import sinontest from 'sinon-test';
import sinonchai from 'sinon-chai';
import chaiaspromised from 'chai-as-promised';
import chaievents from 'chai-events';
import log from 'loglevel';

sinon.test = sinontest(sinon);

chai.use(sinonchai);
chai.use(chaiaspromised);
chai.use(chaievents);

global.expect = chai.expect;

// Prevent log output from polluting test report
log.disableAll();