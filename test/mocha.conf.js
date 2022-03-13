import chai from 'chai';
import sinon from 'sinon';
import sinontest from 'sinon-test';
import sinonchai from 'sinon-chai';
import chaiaspromised from 'chai-as-promised';
import chaievents from 'chai-events';
import chainock from 'chai-nock';
import log from 'loglevel';

sinon.test = sinontest(sinon);
// Make unmatched nock requests time out after 500ms. This allows to run four unsuccessful requests and still
// show a proper test failure reason, instead of the test failing due to mocha timing out the test itself.
chainock.setTimeout(500); 

chai.use(sinonchai);
chai.use(chaiaspromised);
chai.use(chaievents);
chai.use(chainock);

global.expect = chai.expect;

// Prevent log output from polluting test report
log.disableAll();