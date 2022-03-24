import { WargamingAPI } from '../../src/util/wgapi.js';
import nock from 'nock';
import httpError from 'http-errors';
const HTTPError = httpError.HttpError;

describe('WargamingAPI', function() {
	let api;
	let apiSrv;

	before(function() {
		apiSrv = nock(/worldofwarships/);
		nock.disableNetConnect();
	});

	beforeEach(function() {
		api = new WargamingAPI('', '');
		nock.cleanAll();
	});

	after(function() {
		nock.restore();
		nock.enableNetConnect();
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
			apiSrv.get(/./).reply(200, {
				status: 'error',
				error: { code: 407, message: 'INVALID_APPLICATION_ID' }
			});
			return expect(api.access('', {})).to.be.rejectedWith(WargamingAPI.APIError);
		});

		it('should throw an APIError if the request limits have been exceeded', function() {
			apiSrv.get(/./).reply(200, {
				status: 'error',
				error: {
					code: 407,
					message: 'REQUEST_LIMIT_EXCEEDED'
				}				
			});
			return expect(api.access('', {})).to.be.rejectedWith(WargamingAPI.APIError);			
		});

		it('should throw an Error if there was an HTTP error', function() {
			// Fetch returned 404 Not found
			// (As per the spec, the promise still resolves)
			apiSrv.get(/./).reply(404, 'Not found');
			return expect(api.access('', {})).to.be.rejectedWith(HTTPError);
		});

		it('should throw an Error if there was a network error', function() {
			// The network was unavailable, as per the spec, this is the only case where fetch rejects
			// global.fetch.rejects(Response.error());
			return expect(api.access('', {})).to.be.rejected;
		});

		it('should call the correct domain based on the realm', async function() {
			for (let realm of ['na','eu','ru','asia']) {
				const req = apiSrv.get(/./).reply(200, {});
				api = new WargamingAPI('', realm);
				api.access('', {});
				await expect(req, realm).to.have.been.requestedWithHeadersMatch({ 
					host: `api.worldofwarships.${realm === 'na' ? 'com' : realm}`
				});			
			}
		});

		it('should HTTP GET the correct endpoint based on the requested API operation', async function() {
			for (let oper in WargamingAPI.OPERATIONS) {
				const req = apiSrv.get(new RegExp(WargamingAPI.OPERATIONS[oper])).reply(200, {});
				api.access(oper, {});
				await expect(req, oper).to.have.been.requested;
			}
		});

		it('should automatically set the application_id, but prefer one passed in params', async function() {
			api = new WargamingAPI('appid', '');
			let req = apiSrv.get(/./).query({ application_id: 'appid' }).reply(200, {});
			api.access('', {});
			await expect(req).to.have.been.requested;

			req = apiSrv.get(/./).query({ application_id: 'otherid' }).reply(200, {});
			api.access('', { application_id: 'otherid' });
			await expect(req).to.have.been.requested;
		});

		it('should use the passed arguments for the request', async function() {
			let params = { a: 1, b: false, c: 'string' }
			let req = apiSrv
				.get(/./)
				// All entries of params must be the same in the query after conversion to a string 
				// (but query may have more, e.g. application_id - we don't care about that)				
				.query(q => Object.keys(params).every(key => q[key] == String(params[key])))
				.reply(200, {});

			api.access('', { a: 1, b: false, c: 'string' });
			await expect(req, 'primitive params').to.have.been.requested;			

			params = { arr: [ 1, 2, 3 ] };
			req = apiSrv
				.get(/./)
				.query(q => q.arr === '1,2,3')
				.reply(200, {});
			api.access('', params);
			await expect(req, 'array param').to.have.been.requested;
		});

		it('should return the data field of a successful API access', function() {
			const data = { prop: 'prop' };
			apiSrv.get(/./).reply(200, {
				status: 'ok',
				meta: { count: 1, hidden: null },
				data: data
			});
			return expect(api.access('', {})).to.eventually.deep.equal(data);
		});
	});
});