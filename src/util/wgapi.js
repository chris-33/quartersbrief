import fetch from 'node-fetch';
import template from 'pupa';
import httpError from 'http-errors';

class WargamingAPI {
	
	/**
	 * The top level domain to use for calls to the Wargaming API. Dependent on the realm:
	 * Realm | Top Level Domain
	 * --- | ---
	 * NA | com
	 * EU | eu
	 * Russia | ru
	 * Asia | asia
	 */
	tld;

	#applicationID;

	static APIError = class extends Error {
		// See https://developers.wargaming.net/documentation/guide/getting-started/
		// (section 'Common API Errors')
		static MESSAGES = {
			METHOD_NOT_FOUND: 'Invalid API method',
			METHOD_DISABLED: 'Specified method is disabled',
			APPLICATION_IS_BLOCKED: 'Application is blocked by the administration',
			INVALID_APPLICATION_ID: 'Invalid application ID',
			INVALID_IP_ADDRESS: 'Invalid IP address for the server application',
			REQUEST_LIMIT_EXCEEDED: 'Request limit exceeded',
			SOURCE_NOT_AVAILABLE: 'Data source is not available',
			FIELD_NOT_SPECIFIED: 'Required field {field} not specified',
			FIELD_NOT_FOUND: 'Field {field} not found',
			FIELD_LIST_LIMIT_EXCEEDED: 'Limit of passed-in identifiers in the {field} exceeded',
			INVALID_FIELD: 'Specified field value {field} is not valid.'
		};

		constructor(code, msg, url) {
			let field;
			if (code === 402) {
				let result = msg.match(/(\w+)_NOT_SPECIFIED/);
				field = result[1];
				msg = 'FIELD_NOT_SPECIFIED';
			} else if (code === 404) {
				let result = msg.match(/(\w+)_NOT_FOUND/);
				if (result[1].toUpperCase() !== 'METHOD') {
					field = result[1];
					msg = 'FIELD_NOT_FOUND';
				}
			} else if (code === 407) {
				let result = msg.match(/INVALID_(\w+)/);
				if (result && result[1].toUpperCase() !== 'APPLICATION_ID' && result[1].toUpperCase() !== 'IP_ADDRESS') {
					field = result[1];
					msg = 'INVALID_FIELD';
				}
				result = msg.match(/(\w+)_LIST_LIMIT_EXCEEDED/);
				if (result) {
					field = result[1];
					msg = 'FIELD_LIST_LIMIT_EXCEEDED';
				}
			}
			msg = template(WargamingAPI.APIError.MESSAGES[msg], { field });
			super(`Error during Wargaming API access to ${url?.hash}: ${msg}.`);
			this.code = code;
			this.url = url;
		}
	}

	static OPERATIONS = {
		'PLAYERS.LIST': 'accounts/list',
		'PLAYERS.DATA': 'accounts/info'
	}

	constructor(applicationID, realm) {
		this.#applicationID = applicationID;

		if (realm.toLowerCase() === 'na')
			this.tld = 'com';
		else
			this.tld = realm.toLowerCase();
	}

	/**
	 * Constructs a URL for the passed API operation `op` and arguments `params`, taking into account
	 * the realm and application ID. If an application ID is present in `params`, it will be used instead
	 * of the one stored in this `WargamingAPI`.
	 * @param  {String} op     The operation to be carried out.
	 * @param  {Object} params A hash from argument keys to argument values. Array values will be joined
	 * into a comma-separated string.
	 * @return {URL}        The URL.
	 */
	#getURL(op, params) {
		const url = new URL(WargamingAPI.OPERATIONS[op.toUpperCase()], `https://api.worldofwarships.${this.tld}/wows/`);
		if (!Object.keys(params).includes('application_id'))
			url.searchParams.append('application_id', this.#applicationID);
		for (let param in params) {
			let val = params[param];
			if (Array.isArray(val))
				val = val.join(',');
			url.searchParams.append(param, val);
		}
		return url;	
	}

	/**
	 * Runs the API operation `op` with the arguments `params` on the Wargaming API. 
	 * @param  {String} op     The API operation to carry out.
	 * @param  {Object} params A hash from argument keys to argument values. Array values will be joined
	 * into a comma-separated string.
	 * @return {Object}        The raw server response is in the form 
	 * ```
	 * {
	 *     status: 'ok'/'error'
	 *     meta: { ... }
	 *     data: { ... }
	 * }
	 * ```
	 * This method returns the `data` field of the response.
	 * @see WargamingAPI#OPERATIONS
	 */
	async access(op, params) {
		const url = this.#getURL(op, params);
		let res = await fetch(url.href);

		// fetch() promise resolves instead of rejecting even if HTTP status code is 
		// not ok-ish (200-299), so we need to throw manually in that case.
		if (!res.ok)
			throw httpError(res.status, res.statusText);
		
		res = await res.json();
		if (res.status === 'error')
			throw new WargamingAPI.APIError(res.error.code, res.error.message, url);

		return res.data;
	}
}

export { WargamingAPI }