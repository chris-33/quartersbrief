import viewFrom from './view-from.js';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

export default class ArmorViewer {
	cache = {};

	constructor(armordir) {
		this.armordir = armordir;
	}

	async view(ship, view) {
		if (!(ship in this.cache)) {
			this.cache[ship] = JSON.parse(await readFile(path.format({
				dir: this.armordir, 
				name: ship,
				ext: '.json'
			})));
		}
		let armor = this.cache[ship];

		if (!(view in armor)) {
			const axis = {
				'front': 2,
				'top': 1,
				'side': 0
			}[view];

			armor[view] = await viewFrom(armor.source, axis);
			
			await writeFile(path.format({
					dir: this.armordir, 
					name: ship,
					ext: '.json'
			}), JSON.stringify(armor));
		}
		
		return armor[view];
	}
}