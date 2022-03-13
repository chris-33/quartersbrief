import { ComplexDataObject } from '../util/cdo.js';

class Player {
	constructor(data) {
		this._data = ComplexDataObject(data);
	}

	get name() { return this._data.nickname; }
	get battles() { return this._data.statistics.pvp.battles; }
	get victories() { return this._data.statistics.pvp.wins; }
	get winrate() { return this.battles > 0 ? this.victories / this.battles : 0; }// Treat someone who hasn't played any battles as 0% winrate
}

export { Player }