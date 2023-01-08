import createView from './create-view.js';
import Ship from '../model/ship.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import rootlog from 'loglevel';

const dedicatedlog = rootlog.getLogger('ArmorViewer');

/**
 * This class manages views of ships' armor. Views are two-dimensional representations of a ship's exterior armor. In essence, a view corresponds to those
 * parts of a ship's armor that can be "seen" from a given direction. A view can be obtained by calling `ArmorViewer#view()`. 
 *
 * Because view generation is expensive, this class employs several caching strategies. Firstly, previously requested views are held in an in-memory cache. 
 * In addition, views are persisted to disk. Only if neither the in-memory nor the file cache can provide a valid cached view is a new view generated. 
 * A file-cached view is considered "valid" if its hash is equal to the raw-armor file's hash. Caching is handled transparently and in such a way that even
 * if a given view is requested again while it is still being generated, it will only be generated once.
 */
export default class ArmorViewer {
	/**
	 * Holds created/read views and the raw armor models for ships. Keys are in the form `<ship model name>.<view>`, e.g. `AAA001_Battleship.front`. 
	 * For the raw armor model, the view suffix is `raw`. 
	 * 
	 * Note that this cache has holds _promises_, not the actual values. This allows multiple concurrent requests for the same view to work off the 
	 * same promise, instead of running the expensive armor view calculations for each one of them.
	 * @type {Promise}
	 */
	cache = {};

	/**
	 * Constructs a new `ArmorViewer` that reads raw armor files from `armordir` and cached view files from `cachedir`.
	 */
	constructor(armordir, cachedir) {
		this.armordir = armordir;
		this.cachedir = cachedir;
	}

	/**
	 * Gets the specified view for the specified ship. If the view is in the in-memory cache `ArmorViewer#cache`, it is returned.
	 * Oterhwise, if a cache file for that ship and view exists in `ArmorViewer#cachedir`, and has the same hash
	 * metadata as the ship's armor file in `ArmorViewer#armordir`, the view from the cache file is added to the in-memory cache and returned. 
	 * Otherwise, the view is created, added to the in-memory cache and a cache file written for it.
	 *
	 * @param  {Ship|string} ship The ship for which to get the view. If this is a `Ship` object, its armor model is read from `ship.hull.model`.
	 * @param  {string} view The view to get. Can be one of `top`, `side` or `front`.
	 * @return {Promise}      A promise that resolves to the view.
	 */
	async view(ship, view) {
		// If we got passed a ship object, get the name of the armor model from it
		if (ship instanceof Ship)
			ship = path.basename(ship.get('hull.model'), '.model');

		// The name under which that view will be in the cache
		const designator = `${ship}.${view}`;
		// The name under which the raw armor model for the ship will be in the cache
		const rawDesignator = `${ship}.raw`;

		// If the requested view is not in memory, try to read it from cache file
		if (!this.cache[designator]) {
			// If the raw armor is not in memory, read it from disk.
			// We may need it to calculate a view, and we will definitely need it to check hashes
			if (!this.cache[rawDesignator]) { 
				this.cache[rawDesignator] = readFile(path.format({
					dir: this.armordir, 
					name: ship,
					ext: '.json'
				})).then(JSON.parse);
			}
			const armor = this.cache[rawDesignator];

			// Attempt to read view from cache file and cache the promise
			this.cache[designator] = readFile(path.format({
					dir: this.cachedir,
					name: designator,
					ext: '.json'
				}))
				.then(contents => {
					dedicatedlog.debug(`Read cached view file for ${ship}`);
					return contents;
				})
				.then(JSON.parse)				
				.catch(async err => {
					// If no cache file exists, create a new view object.
					// Otherwise, re-raise the error (or, more specifically, propagate the rejection)
					if (err.code === 'ENOENT') {
						dedicatedlog.debug(`Found no cached views file for ${ship}`);
						return {
							metadata: {
								hash: (await armor).metadata.hash
							}
						};
					}
					else
						throw err;
				})
				.then(async cached => {
					// Check that hashes match.
					// If the cached file's hash is different from the raw armor file's hash, that means the cached file
					// is for an outdated version of the ship. 
					// In that case, invalidate it.
					if (cached.metadata.hash.toLowerCase() !== (await armor).metadata.hash.toLowerCase()) {						
						dedicatedlog.debug(`Invalidated cached view ${view} for ${ship} because the hashes did not match: old hash ${cached.metadata.hash}, new hash ${(await armor).metadata.hash}`);
						cached = {
							metadata: {
								hash: (await armor).metadata.hash
							}
						};
					}
					return cached;
				});			
		}
		// A (promise to) the requested view is now guaranteed to be in cache.
		// If it has a view property, return that. If it doesn't, we need to construct the view.
		// Note that the view property may be a promise: If the view was not previously read from file (or was invalidated),
		// this property is the promise returned from createView.
		if ((await this.cache[designator]).view) {
			rootlog.debug(`Took ${view} view for ${ship} from cache`);
			return (await this.cache[designator]).view;
		}
		
		const axis = {
			'front': 2,
			'top': 1,
			'side': 0
		}[view];

		const result = await this.cache[designator];
		// Create the view and cache its promise.
		result.view = createView((await this.cache[rawDesignator]).armor, axis)
			// Adjust orientation of the result
			.then(result => {
				const flip = {
					'side': ([ x, y ]) => [ y, -x ],
					'top': ([ x, y ]) => [ y, x ],
					'front': ([ x, y ]) => [ x, -y ]
				}[view];
				for (let id in result) {
					const piece = result[id];
					for (let i = 0; i < piece.length; i++)
						piece[i] = piece[i].map(flip);					
				}
				return result;
			})
			.then(result => {
				rootlog.debug(`Created ${view} view for ${ship}`);
				return result;
			})
			// Write the new cache file.
			.then(async data => {
				// Create the cache dir if it does not exist:
				await mkdir(this.cachedir, { recursive: true });
				await writeFile(path.format({
						dir: this.cachedir, 
						name: designator,
						ext: '.json'
					}), 
					// Note that we can't just do JSON.stringify(result), because result.view
					// will then be a promise, which JSON.stringify can't correctly serialize.
					JSON.stringify({					
						...result,
						view: data
					}));
				return data;
			});
		// Return the promise to the view.
		return result.view;
	}
}