import { Player } from './player.js';
import { WargamingAPI } from '../util/wgapi.js';

class PlayerFactory {	
	constructor(applicationID, realm) {
		this._api = new WargamingAPI(applicationID, realm);
	}

	/**
	 * Translates player names to their account IDs. 
	 *
	 * This operation involves a network call to the Wargaming API.
	 * @param  {String[]} names The names of the players to get account IDs for.
	 * @return {Object}       A hash from player names to account IDs.
	 * @throws See {@link WargamingAPI#access} for the error behavior of this method.
	 */
	async getAccounts(names) {		
		let data = await this._api.access('players.list', { search: names, type: 'exact' });
		
		let result = {};
		for (let player of data)
			result[player.nickname] = player.account_id;
		return result;
	}

	
	async getPlayers(designators) {
		const names = designators.filter(designator => typeof designator === 'string');
		let accounts = designators.filter(designator => typeof designator === 'number');
		if (names.length > 0)
			accounts.concat(Object.values(await this.getAccounts(names)));
		
		let data = await this._api.access('players.data', { account_id: accounts });
		
		let result = {};
		// data is a hash from account IDs to player data
		// Translate it into a hash from player names to instances of Player
		for (let id in data) {
			let player = data[id];
			result[player.nickname] = new Player(player);
		}
		return result;
	}

}

export { PlayerFactory }