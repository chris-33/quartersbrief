import Supplier from './supplier.js';
import Player from '../model/player.js';
import WargamingAPI from '../util/wgapi.js';
import rootlog from 'loglevel';

export default class PlayerProvider {
	constructor(applicationID, realm) {
		this.api = new WargamingAPI(applicationID, realm);
		this.supplier = new PlayerProvider.PlayerSupplier();
	}

	async getPlayers(designators) {
		const dedicatedlog = rootlog.getLogger(this.constructor.name);

		// Filter out bots and keep them in a separate list
		// Bots are players whose name starts and ends with a colon
		const bots = designators.filter(name => typeof name === 'string' && name.match(/^:.+:$/));
		if (bots.length > 0)
			dedicatedlog.debug(`Detected bots: ${bots}.`);

		designators = designators.filter(designator => !bots.includes(designator));

		const request = new PlayerProvider.PlayerSupplier.Request(this.api);
		this.supplier.recover = PlayerProvider.PlayerSupplier.prototype.recover.bind(this.supplier, request);
		let result = Promise.all(designators.map(designator => this.supplier.get(designator)));
		await request.execute();

		result = (await result)
			.filter(Boolean) // Filter out players that could not be retrieved
			.map(player => new Player(player))
			.concat(bots.map(bot => Player.createBot(bot)))
			.map(player => [ player.name, player ]);

		return Object.fromEntries(result);
	}

}

/**
 * Helper class that extends Supplier with request handling.
 */
PlayerProvider.PlayerSupplier = class extends Supplier {
	static TTL = 5 * 60 * 1000; // time to live in ms

	recover(request, designator) {
		const result = request.add(designator);
		// Set a timestamp ON THE PROMISE, not the promise's value
		result.timestamp = Date.now();
		return result;
	}

	validate(item) {
		return item.timestamp + PlayerProvider.PlayerSupplier.TTL >= Date.now();
	}
}

/**
 * Helper class that allows to collect multiple player supply requests into a single conglomerate request, instead of making a multitude of
 * individual network calls.
 *
 * Procurement requests can be added with `add()`. The request is executed with `execute()`. After it executes, no more supply
 * requests may be added.
 */
PlayerProvider.PlayerSupplier.Request = class {
	designators = [];
	
	/**
	 * Creates a new `Request` which will use the provided `WargamingAPI` when it executes.
	 * @param  {WargamingAPI} wgapi The Wargaming API encapsulation to use for hitting the online API.
	 */
	constructor(wgapi) {
		this.api = wgapi;
		let resolve, reject;
		this._result = new Promise((res, rej) => {
			resolve = res;
			reject = rej;
		});
		this._result.resolve = resolve;
		this._result.reject = reject;
	}

	/**
	 * Adds `designator` to the list of players to get data for when this request executes. `add` returns a promise that resolves
	 * with the data for the requested player, if any, or rejects if `execute` rejected.
	 *
	 * It is an error to try to add designators to a request that has already been executed, and will result in a rejection.
	 * @param {Number|String} designator The player designator to add. If this is a string, it will be translated to an account
	 * id with an extra call to the Wargaming API. If it is a number, it is assumed to be an account id.
	 * @returns {Promise<Object>} A promise that fulfills with the player data for `designator`, and rejects with the same reason
	 * if request execution rejects.
	 */
	async add(designator) {
		if (this.executed)
			throw new Error(`Cannot add more to a Wargaming API request that has already been executed. Start a new request.`);

		this.designators.push(designator);
		return (await this._result)[designator];
	}

	/**
	 * Executes this request against the Wargaming API, requesting player data for all previously added player designators.
	 * Any player designators that were strings are first translated to account ids with an extra call to the Wargaming API.
	 * Player designators that were numbers are assumed to be account ids.
	 * 
	 * @return {Promise<Object>} A promise that fulfills with a hash from player nickname to player data.
	 */
	async execute() {
		if (!this.executed) {
			this.executed = true;
			// Propagate ANY exception happening in this code to a rejection of the request result
			try {
				const dedicatedlog = rootlog.getLogger(PlayerProvider.name);
	
				// Designators that are a number are expected to be account IDs
				let accounts = this.designators.filter(designator => typeof designator === 'number');
				dedicatedlog.debug(`Designators detected as account IDs: ${accounts}`);
				
				// Designators that are a string are expected to be nicknames
				let names = this.designators.filter(designator => typeof designator === 'string');
				dedicatedlog.debug(`Designators detected as names: ${names}.`);
	
				if (names.length > 0)
					accounts = accounts.concat((await this.api.access('players.list', { search: names, type: 'exact' })).map(info => info.account_id))			
				
				dedicatedlog.debug(`Final account IDs: ${accounts}. Requesting data`);
				let data = accounts.length > 0 ? 
					// Only call the API if there is at least one account we are requesting
					await this.api.access('players.data', { account_id: accounts }) : 
					// Otherwise shortcut to empty result
					{};
				
				let result = {};
				// data is a hash from account IDs to player data
				// Translate it into a hash from player names to instances of Player
				for (let id in data) {
					let player = data[id];
					if (player)
						result[player.nickname] = player;
				}
	
				this._result.resolve(result);
			} catch(err) {
				this._result.reject(err);
			}
		}
		return this._result;
	}
}