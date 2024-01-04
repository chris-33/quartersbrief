import DataObject, { expose } from './dataobject.js';

export default class Player extends DataObject {
	bot = false;

	get battles() { return this.bot ? NaN : this._data.statistics?.pvp?.battles; }
	get victories() { return this.bot ? NaN : this._data.statistics?.pvp?.wins; }
	get winrate() { 
		if (this.hidden) return undefined; // Because undefined/undefined === NaN
		// Treat someone who hasn't played any battles as 0% winrate
		return this.battles === 0 ? 0 : this.victories / this.battles;
	}

	static createBot(name) {
		let player = new Player({ nickname: name });
		player.bot = true;
		return player;
	}
}
expose(Player, {
	'hidden': 'hidden_profile',
	'name': 'nickname',
})