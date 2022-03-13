import { WargamingAPI } from '../../src/util/wgapi.js';
import { Response } from 'node-fetch';
import httpError from 'http-errors';
const HTTPError = httpError.HttpError;
import sinon from 'sinon';

describe.only('WargamingAPI', function() {
	let api;

	beforeEach(function() {
		sinon.stub(global, 'fetch');
		api = new WargamingAPI('', '');
	});

	afterEach(function() {
		global.fetch.restore();
	});

	describe('WargamingAPI.APIError', function() {
		it('should correctly translate errors %FIELD%_NOT_SPECIFIED, %FIELD%_NOT_FOUND, %FIELD%_LIST_LIMIT_EXCEEDED and INVALID_%FIELD%', function() {
			let err;
			err = new WargamingAPI.APIError(402, 'ABC_NOT_SPECIFIED');
			expect(err.message, '%FIELD%_NOT_SPECIFIED').to.match(/ABC/);

			err = new WargamingAPI.APIError(404, 'ABC_NOT_FOUND');
			expect(err.message, '%FIELD%_NOT_FOUND').to.match(/ABC/);
			// METHOD_NOT_FOUND error is very similar to %FIELD%_NOT_FOUND, make sure it doesn't get picked up as that:
			err = new WargamingAPI.APIError(404, 'METHOD_NOT_FOUND');
			expect(err.message, 'METHOD_NOT_FOUND').to.not.match(/METHOD/);

			err = new WargamingAPI.APIError(407, 'ABC_LIST_LIMIT_EXCEEDED');
			expect(err.message, '%FIELD%_LIST_LIMIT_EXCEEDED').to.match(/ABC/);

			err = new WargamingAPI.APIError(407, 'INVALID_ABC');
			expect(err.message, 'INVALID_%FIELD%').to.match(/ABC/);
			// INVALID_APPLICATION_ID error is very similar to %FIELD%_NOT_FOUND, make sure it doesn't get picked up as that:
			err = new WargamingAPI.APIError(407, 'INVALID_APPLICATION_ID');
			expect(err.message, 'INVALID_APPLICATION_ID').to.not.match(/APPLICATION/);
			// INVALID_IP_ADDRESS error is very similar to %FIELD%_NOT_FOUND, make sure it doesn't get picked up as that:
			err = new WargamingAPI.APIError(407, 'INVALID_IP_ADDRESS');
			expect(err.message, 'INVALID_IP_ADDRESS').to.not.match(/ADDRESS/);
		});
	});

	describe('.access', function() {
		it('should throw an APIError if there is no application ID', async function() {
			global.fetch.resolves(new Response(JSON.stringify({
				status: 'error',
				error: {
					code: 407,
					message: 'INVALID_APPLICATION_ID'
				}				
			})));
			return expect(api.access('', {})).to.be.rejectedWith(WargamingAPI.APIError);
		});

		it('should throw an APIError if the request limits have been exceeded', function() {
			global.fetch.resolves(new Response(JSON.stringify({
				status: 'error',
				error: {
					code: 407,
					message: 'REQUEST_LIMIT_EXCEEDED'
				}				
			})));
			return expect(api.access('', {})).to.be.rejectedWith(WargamingAPI.APIError);			
		});

		it('should throw an Error if there was an HTTP error', function() {
			// Fetch returned 404 Not found
			// (As per the spec, the promise still resolves)
			global.fetch.resolves(new Response(null, { status: 404, statusCode: 'Not found' }));
			return expect(api.access('', {})).to.be.rejectedWith(HTTPError);
		});

		it('should throw an Error if there was a network error', function() {
			// The network was unavailable, as per the spec, this is the only case where fetch rejects
			global.fetch.rejects(Response.error());
			return expect(api.access('', {})).to.be.rejected;
		});

		it('should return the data field of a successful API access', function() {
			const data = { prop: 'prop' };
			global.fetch.resolves(new Response(JSON.stringify({
				status: 'ok',
				meta: { count: 1, hidden: null },
				data: data
			})));
			return expect(api.access('', {})).to.eventually.deep.equal(data);
		});
	});
});