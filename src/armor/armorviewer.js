import polybool from 'polybooljs';
import { convertDown, fuse, smooth } from 'geometry-3d';
import { Pool, Worker, spawn } from 'threads';
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
	// Factory function for spawning worker threads
	pool = Pool(() => spawn(new Worker('./occlude-worker.js')));

	/**
	 * The precision to round result coordinates to.
	 * Basically, this can be thought of the size of the "pixels" or a "grid" that the result polygons are inscribed into.
	 * 
	 * If ArmorViewer.PRECISION is too small (the grid is too fine), we get more zero-length errors from polybool both in the occlusion and in the
	 * merging phase, and artifacts where triangles don't exactly line up after occluding and are thus not merged in the result polygon.
	 * If ArmorViewer.PRECISION is too large (the grid is too coarse), we lose details and get boxy-looking results.
	 * 
	 * Experimentation has shown that 1.0e-3 is a good compromise. It eliminates almost all zero-length errors both in the occlusion and in the
	 * merging phase, and still provides a sufficient level of detail in the output that the gridding is not really noticeable.
	 * @type {Number}
	 */
	static PRECISION = 1.0e-3;
	/**
	 * The minimum area of created polygons. Polygons smaller than this will be considered artifacts of the algorithm and filtered out.
	 * @type {Number}
	 */
	static MIN_AREA = 5.0e-3;
	/**
	 * The lookahead length when checking result polygons for aberrant chains.
	 * @type {Number}
	 */
	static LOOKAHEAD = 3;

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
	 * Generates a new view for the given armor model, along the given axis. This is done by taking all armor pieces found in the model
	 * and mutually occluding all their constituent triangles against each other (including occluding each piece with itself) and flattening
	 * the result to two dimensions. This can be thought of as standing on the positive half of the view axis, placing the model in the origin 
	 * and then looking along the view axis.
	 *
	 * Because occlusion is a lengthy and CPU-heavy operation, it is handed off to worker threads so as to avoid blocking the main thread and
	 * leverage the performance gains from multi-threading.
	 * @param  {Object} model    The three-dimensional armor model. This is an object holding each armor piece under a key that is the numeric
	 * id of the piece. Armor pieces are arrays of triangles, where triangles are arrays of vertices and vertices are arrays of coordinates in the
	 * form `[x,y,z]`.
	 * @param  {number} viewAxis The axis along which to look. Can be `0` for the x-axis, `1` for the y-axis, `2` for the z-axis. 
	 * @return {Object}          The generated view. This is an object with the same keys (i.e., the same armor pieces) as `model`, where each piece
	 * is now an array of **polygons**. Polygons are arrays of two-dimensional vertices.
	 */
	async createView(model, viewAxis) {
		function area(poly) {
			let area = 0;
			for (let i = 0; i < poly.length; i++) {
				let curr = poly[i];
				let next = poly[(i + 1) % poly.length];
				area += (next[1] + curr[1]) * (next[0] - curr[0]);
			}
			return area / 2;
		}


		// Do an initial fitting of the model into the grid. (This is still in three dimensions.)
		let _model = model;
		model = {};
		for (let id in _model) {
			model[id] = _model[id]
				.map(tri => tri.map(vertex => vertex.map(coord => Math.round(coord / ArmorViewer.PRECISION) * ArmorViewer.PRECISION)))
				// Fuse and filter out triangles that have collapsed (where two vertices have been rounded to the same spot)
				.map(tri => fuse(tri, ArmorViewer.PRECISION**2))
				.filter(poly => poly.length >= 3);
		}
		
		// @todo Remove torpedo protection

		// Occlude all pieces mutually, including against self, using worker threads. 
		// See documentation at https://www.npmjs.com/package/threads for what exactly is happening here.
		// Basically, we are creating a pool of dedicated worker threads and then enqueueing tasks of the form
		// "occlude this piece against everything" in such a way that we benefit from intermediate results. 
		// I.e. a piece that has already been reduced through occlusion we will be seen by subsequent tasks in
		// its reduced form, not its original form.
		const tasks = [];
		for (let id in model) {
			// Queue occlusion for all pieces present in the armor model.
			// The arrow function will be run when the task is de-queued, meaning it will receive
			// any updates to model from previous tasks. This allows us to benefit from the reduction in triangle
			// numbers when pieces have already been occluded. (Note that because tasks each get a separate copy of 
			// all input when they are started, this is not the case for those tasks that are already running. The
			// performance penalty of this is acceptable though, and it does save us the headache of needing to 
			// handle pieces suddenly changing mid-process.)
			tasks.push(this.pool.queue(async occludePiece => model[id] = await occludePiece(model[id], model, viewAxis)));
		}
		// Wait for all tasks to complete
		await Promise.all(tasks);
		
		// Convert the occluded pieces to two dimensions.
		for (let id in model)
			model[id] = model[id].map(tri => convertDown(tri, viewAxis));

		// Merge the two-dimensional pieces to their largest possible polygons.
		// Right now, pieces are still collections of triangles. We will merge all triangles for which it is 
		// possible into polygons. 
		for (let id in model) {
			let piece = model[id];
			let result = polybool.segments({
				regions: [],
				inverted: false
			});
			
			// Align all triangles of this piece into the grid by rounding all coordinates to a precision of ArmorViewer.PRECISION.
			// This is necessary because otherwise polybooljs tends to generate errors on vertices that are very close together,
			// but not identical.
			piece = piece
					.map(tri => tri.map(vertex => vertex.map(coord => Math.round(coord / (ArmorViewer.PRECISION)) * ArmorViewer.PRECISION)))
					// Fuse and filter out triangles that have collapsed
					.map(tri => fuse(tri, ArmorViewer.PRECISION**2))
					.filter(poly => poly.length >= 3);
					
			// Expand all triangles by a little bit. This helps to conceal artifacts caused by occluded triangles not lining up exactly (especially
			// after having just been rounded to grid), which otherwise show up as holes or stray lines.
			// 
			// The way this works is, we divide the bounding box of the triangle into nine areas. Vertices' x and y coordinates get shifted according to what
			// area they are in. This is less accurate than actually scaling from the triangles circumcenter. But it is a lot faster.
			// +------------+------------+------------+
			// |            |            |            |
			// | shift left |  shift up  | shift right|
			// | and up     |            | and up     |
			// |            |            |            |
			// +------------+------------+------------+
			// |            |            |            |
			// | shift left |   do not   | shift right|
			// |            |   shift    |            |
			// |            |            |            |
			// +------------+------------+------------+
			// |            |            |            |
			// | shift left | shift down | shift right|
			// | and down   |            | and down   |
			// |            |            |            |
			// +------------+------------+------------+
			piece = piece.map(tri => {
						const x = tri.map(vertex => vertex[0]);
						const y = tri.map(vertex => vertex[1]);
						const leftX = Math.min(...x) + 1/3 * (Math.max(...x) - Math.min(...x));
						const rightX = Math.min(...x) + 2/3 * (Math.max(...x) - Math.min(...x));
						const bottomY = Math.min(...y) + 1/3 * (Math.max(...y) - Math.min(...y));
						const topY = Math.min(...x) + 2/3 * (Math.max(...x) - Math.min(...x));
						return tri.map(([ x, y ]) => {
							if (x < leftX) x -= ArmorViewer.PRECISION
							else if (x > rightX) x += ArmorViewer.PRECISION;

							if (y < bottomY) y -= ArmorViewer.PRECISION
							else if (y > topY) y += ArmorViewer.PRECISION;
							
							return [ x, y ];
						});
					});

		
			for (let tri of piece) {
				tri = {
					regions: [ tri ],
					inverted: false
				};
				// The number of retries before the offending polygon is ignored.
				let retries = 1;
				do {
					try {
						result = polybool.selectUnion(polybool.combine(result, polybool.segments(tri)));
					} catch (err) {
						// @todo Find better error recovery for zero-length segment errors when unioning
						// 
						// What might work: 
						// 1. Manually calculate intersections and insert them into both polygons
						// 2. Round intersections to ArmorViewer.PRECISION, i.e. align them with the grid
						// 3. Retry
						if (retries > 0 && err.message.match(/zero-length/i)) {
							// If we get a zero-length error, re-align the polygon into the grid and retry
							result = polybool.polygon(result);
							result.regions = result.regions
								.map(region => region.map(vertex => vertex.map(coord => Math.round(coord / ArmorViewer.PRECISION) * ArmorViewer.PRECISION)))
								// Fuse and filter out edges that have collapsed
								.map(tri => fuse(tri, ArmorViewer.PRECISION**2))
								.filter(poly => poly.length >= 3);
							result = polybool.segments(result);						
						} else if (retries === 0 && err.message.match(/zero-length/i))
							rootlog.error(`Ignored a polygon because of a zero-length error when creating armor view`);
						else 
							throw err;
					}
				} while (retries-- > 0);
			}
			model[id] = polybool
				.polygon(result)
				.regions
				// Filter out artifacts
				.map(region => smooth(region, ArmorViewer.PRECISION**2, ArmorViewer.LOOKAHEAD))
				.filter(region => Math.abs(area(region)) >= ArmorViewer.MIN_AREA);
		}

		return model;
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
		result.view = this.createView((await this.cache[rawDesignator]).armor, axis)
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