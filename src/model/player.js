export default class Player {
	bot = false;

	constructor(data) {
		this._data = data;
	}

	isHidden() { return this._data.hidden_profile; }

	getName() { return this._data.nickname; }
	getBattles() { return this.isBot() ? NaN : this._data.statistics?.pvp?.battles; }
	getVictories() { return this.isBot() ? NaN : this._data.statistics?.pvp?.wins; }
	getWinrate() { 
		if (this.isHidden()) return undefined; // Because undefined/undefined === NaN
		// Treat someone who hasn't played any battles as 0% winrate
		return this.getBattles() === 0 ? 0 : this.getVictories() / this.getBattles();
	}
	isBot() { return Boolean(this.bot); }

	static createBot(name) {
		let player = new Player({ nickname: name });
		player.bot = true;
		return player;
	}
}