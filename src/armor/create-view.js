import polybool from 'polybooljs';
import { convertDown, fuse } from 'geometry-3d';
import { Pool, Worker, spawn } from 'threads';
import rootlog from 'loglevel';

// The precision to round result coordinates to.
// Basically, this can be thought of the size of the "pixels" or a "grid" that the result polygons are inscribed into.
// 
// If PRECISION is too small (the grid is too fine), we get more zero-length errors from polybool both in the occlusion and in the
// merging phase, and artifacts where triangles don't exactly line up after occluding and are thus not merged in the result polygon.
// If PRECISION is too large (the grid is too coarse), we lose details and get boxy-looking results.
// 
// Experimentation has shown that 1.0e-3 is a good compromise. It eliminates almost all zero-length errors both in the occlusion and in the
// merging phase, and still provides a sufficient level of detail in the output that the gridding is not really noticeable.
const PRECISION = 1.0e-3;

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
export default async function createView(model, viewAxis) {
	// Do an initial fitting of the model into the grid. (This is still in three dimensions.)
	let _model = model;
	model = {};
	for (let id in _model) {
		model[id] = _model[id]
			.map(tri => tri.map(vertex => vertex.map(coord => Math.round(coord / PRECISION) * PRECISION)))
			// Fuse and filter out triangles that have collapsed (where two vertices have been rounded to the same spot)
			.map(tri => fuse(tri, PRECISION**2))
			.filter(poly => poly.length >= 3);
	}
	
	// @todo Remove torpedo protection

	// Occlude all pieces mutually, including against self, using worker threads. 
	// See documentation at https://www.npmjs.com/package/threads for what exactly is happening here.
	// Basically, we are creating a pool of dedicated worker threads and then enqueueing tasks of the form
	// "occlude this piece against everything" in such a way that we benefit from intermediate results. 
	// I.e. a piece that has already been reduced through occlusion we will be seen by subsequent tasks in
	// its reduced form, not its original form.

	// Factory function for spawning worker threads
	const pool = Pool(() => spawn(new Worker('./occlude-worker.js')));
	for (let id in model) {
		// Queue occlusion for all pieces present in the armor model.
		// The arrow function will be run when the task is de-queued, meaning it will receive
		// any updates to model from previous tasks. This allows us to benefit from the reduction in triangle
		// numbers when pieces have already been occluded. (Note that because tasks each get a separate copy of 
		// all input when they are started, this is not the case for those tasks that are already running. The
		// performance penalty of this is acceptable though, and it does save us the headache of needing to 
		// handle pieces suddenly changing mid-process.)
		pool.queue(async occludePiece => model[id] = await occludePiece(model[id], model, viewAxis));
	}
	// Wait for all tasks to complete
	await pool.completed();
	// Terminate the pool (destroy its threads)
	await pool.terminate();
	
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
		
		// Align all triangles of this piece into the grid by rounding all coordinates to a precision of PRECISION.
		// This is necessary because otherwise polybooljs tends to generate errors on vertices that are very close together,
		// but not identical.
		piece = piece
				.map(tri => tri.map(vertex => vertex.map(coord => Math.round(coord / (PRECISION)) * PRECISION)))
				// Fuse and filter out triangles that have collapsed
				.map(tri => fuse(tri, PRECISION**2))
				.filter(poly => poly.length >= 3);
	
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
					// 2. Round intersections to PRECISION, i.e. align them with the grid
					// 3. Retry
					if (retries > 0 && err.message.match(/zero-length/i)) {
						// If we get a zero-length error, re-align the polygon into the grid and retry
						result = polybool.polygon(result);
						result.regions = result.regions.map(region => region.map(vertex => vertex.map(coord => Math.round(coord / PRECISION) * PRECISION)))
						result = polybool.segments(result);
						result = polybool.selectUnion(polybool.combine(result, polybool.segments(tri)));
					} else if (retries === 0)
						rootlog.error(`Ignored a polygon because of a zero-length error when creating armor view`);
					else 
						throw err;
				}
			} while (retries-- > 0);
		}
		model[id] = polybool.polygon(result).regions;
	}

	return model;
}