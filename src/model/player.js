class Player {
	bot = false;

	constructor(data) {
		this._data = data;
	}

	get hidden() { return this._data.hidden_profile; }

	get name() { return this._data.nickname; }
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

export { Player }