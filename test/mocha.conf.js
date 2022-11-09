import chai from 'chai';
import sinon from 'sinon';
import sinontest from 'sinon-test';
import sinonchai from 'sinon-chai';
import chaiaspromised from 'chai-as-promised';
import chaievents from 'chai-events';
import chainock from 'chai-nock';
import chaifs from 'chai-fs';
import log from 'loglevel';

sinon.test = sinontest(sinon);
// Make unmatched nock requests time out after 500ms. This allows to run four unsuccessful requests and still
// show a proper test failure reason, instead of the test failing due to mocha timing out the test itself.
chainock.setTimeout(500); 

chai.use(sinonchai);
chai.use(chainock);
chai.use(chaifs);
// This needs to be the last call to use() except for chai-events
// See https://github.com/domenic/chai-as-promised/blob/master/README.md#node
chai.use(chaiaspromised);
// This needs to come after chai-as-promised, or we will have a bunch of false positives.
// Probably related to https://github.com/CodeLenny/chai-events/issues/14
chai.use(chaievents);

global.expect = chai.expect;

// Prevent log output from polluting test report
log.disableAll();