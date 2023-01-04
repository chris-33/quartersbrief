import createView from './create-view.js';
import Ship from '../model/ship.js';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

export default class ArmorViewer {
	cache = {};

	constructor(armordir, cachedir) {
		this.armordir = armordir;
		this.cachedir = cachedir;
	}

	async view(ship, view) {
		if (ship instanceof Ship)
			ship = path.basename(ship.get('hull.model'), '.model');

		let armor;
		let cached = this.cache[ship];
		if (!cached) {
			armor = JSON.parse(await readFile(path.format({
				dir: this.armordir, 
				name: ship,
				ext: '.json'
			})));

			try {
				cached = JSON.parse(await readFile(path.format({
					dir: this.cachedir,
					name: ship,
					ext: '.json'
				})));
			} catch (err) {
				if (err.code !== 'ENOENT')
					throw err;
			}
			if (cached?.metadata.hash.toLowerCase() !== armor.metadata.hash.toLowerCase())
				cached = { 
					metadata: {
						hash: armor.metadata.hash
					}
				};

			this.cache[ship] = cached;
		}

		if (view in cached)
			return this.cache[ship][view];
	
		const axis = {
			'front': 2,
			'top': 1,
			'side': 0
		}[view];

		cached[view] = await createView(armor.armor, axis);
		
		// Flip side view (otherwise the ship is on its side)
		if (view === 'side') {
			for (let id in cached[view]) {
				const piece = cached[view][id];
				for (let i = 0; i < piece.length; i++)
					piece[i] = piece[i].map(([ x, y ]) => [ y, -x ]);
			}
		}
		
		await writeFile(path.format({
				dir: this.cachedir, 
				name: ship,
				ext: '.json'
		}), JSON.stringify(cached));	
		
		return cached[view];
	}
}