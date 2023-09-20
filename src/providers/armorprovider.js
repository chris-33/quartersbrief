import Ship from '../model/ship.js';
import Procurer from './procurer.js';
import fs from 'fs/promises';
import path from 'path';
import rootlog from 'loglevel';

const dedicatedlog = rootlog.getLogger('ArmorViewer');

/**
 * Recovery function for the armor view cache. 
 * 
 * It attempts to read the requested view from the `cachedir` and checks its validity by comparing its hash against
 * the hash of the current base armor from `armordir`. If there is a hash mismatch, or no cached view file exists,
 * a new view is created using the `viewer`.
 *
 * @param  {String} designator The designator of the view to get
 * @return {Promise}            A promise to the requested view.
 */
export async function recover(designator) {
	const designatorBase = designator => designator.slice(0, designator.lastIndexOf('.'));
	// If the requested armor is the raw armor, read it from the armor dir
	if (designator.endsWith('.raw')) {
		return fs.readFile(path.format({
			dir: this.armordir, 
			name: designatorBase(designator),
			ext: '.json'
		}))
		.then(JSON.parse)
	}

	// Get the raw armor from the cache
	// We may need it to calculate a view, and we will definitely need it to check hashes
	const rawDesignator = designatorBase(designator) + '.raw';
	const raw = await this.get(rawDesignator);
	const view = designator.slice(designator.lastIndexOf('.') + 1);			

	const outdatedError = new Error();

	return fs.readFile(path.format({
			dir: this.cachedir,
			name: designator,
			ext: '.json'
		}))
		// Log that we have read the cache file
		.then(contents => {
			dedicatedlog.debug(`Read cached view file for ${designator}`);
			return contents;
		})
		.then(JSON.parse)
		// Check that hashes match
		.then(async cached => {
			// If the cached file's hash is different from the raw armor file's hash, that means the cached file
			// is for an outdated version of the ship. 
			// In that case, invalidate the process by raising outdatedError.
			if (cached.metadata.hash.toLowerCase() !== raw.metadata.hash.toLowerCase()) {						
				dedicatedlog.debug(`Invalidated cached view ${designator} because the hashes did not match: old hash ${cached.metadata.hash}, new hash ${(await raw).metadata.hash}`);
				throw outdatedError;
			}
			return cached;
		})
		// If no cache file exists, or the cache is outdated, prepare a new view object
		// Otherwise, re-raise the error (or, more specifically, propagate the rejection)
		.catch(async err => {
			if (err.code === 'ENOENT' || err === outdatedError) {
				if (err !== outdatedError) dedicatedlog.debug(`Found no cached view file for ${designator}`);
				const result = {
					metadata: { hash: raw.metadata.hash },
					// Create the view
					view: this.viewer.view(raw.armor, view)
						// Write the result to cache file after view creation is finished
						.then(async view => {
							// Create the cache dir if it does not exist:
							await fs.mkdir(this.cachedir, { recursive: true });
							await fs.writeFile(path.format({
								dir: this.cachedir, 
								name: designator,
								ext: '.json'
							}), 
								// Note that we can't just do JSON.stringify(result), because result.view
								// will then be a promise, which JSON.stringify can't correctly serialize.
								JSON.stringify({					
									...result,
									view
								}));
							return view;
						})					
				};
				return result;
			} else
				throw err;
		});
}

/**
 * This class manages views of ships' armor. Views are two-dimensional representations of a ship's exterior armor. In essence, a view corresponds to those
 * parts of a ship's armor that can be "seen" from a given direction. A view can be obtained by calling `ArmorViewer#view()`. 
 *
 * Because view generation is expensive, this class employs several caching strategies. Firstly, previously requested views are held in an in-memory cache. 
 * In addition, views are persisted to disk. Only if neither the in-memory nor the file cache can provide a valid cached view is a new view generated. 
 * A file-cached view is considered "valid" if its hash is equal to the raw-armor file's hash. Caching is handled transparently and in such a way that even
 * if a given view is requested again while it is still being generated, it will only be generated once.
 */
export default class ArmorProvider {

	/**
	 * Holds created/read views and the raw armor models for ships. Keys are in the form `<ship model name>.<view>`, e.g. `AAA001_Battleship.front`. 
	 * For the raw armor model, the view suffix is `raw`. 
	 * 
	 * Note that this cache holds _promises_, not the actual values. This allows multiple concurrent requests for the same view to work off the 
	 * same promise, instead of running the expensive armor view calculations for each one of them.
	 * @type {Promise}
	 */
	cache;

	/**
	 * Constructs a new `ArmorViewer` that reads raw armor files from `armordir` and cached view files from `cachedir`, and generates
	 * armor views if no cached ones exist using the given `viewer`.
	 */
	constructor(armordir, cachedir, viewer) {
		this.procurer = new Procurer(recover);
		this.procurer.armordir = armordir;
		this.procurer.cachedir = cachedir;
		this.procurer.viewer = viewer;
	}
	
	/**
	 * Gets the specified view for the specified ship. If the view is in the in-memory cache, it is returned.
	 * Otherwise, if a cache file for that ship and view exists, and has the same hash metadata as the ship's 
	 * raw armor file, the view from the cache file is added to the in-memory cache and returned. 
	 * Otherwise, the view is created, added to the in-memory cache and a cache file written for it.
	 *
	 * @param  {Ship|string} ship The ship for which to get the view. If this is a `Ship` object, its armor model is read from `ship.hull.model`.
	 * @param  {string} view The view to get. Can be one of `top`, `side` or `front`.
	 * @return {Promise}      A promise that resolves to the view.
	 */
	async getArmorView(ship, view) {
		// If we got passed a ship object, get the name of the armor model from it
		if (ship instanceof Ship)
			ship = path.basename(ship.get('hull.model'), '.model');

		view = view.toLowerCase();
		if (view !== 'top' && view !== 'front' && view !== 'side')
			throw new TypeError(`Unknown view "${view}" requested for ship ${ship}`);
		
		const designator = `${ship}.${view}`;
		const result = await this.procurer.get(designator);

		return result.view;
	}
}