import polybool from 'polybooljs';
import { convertDown, fuse } from 'geometry-3d';
import { Pool, Worker, spawn } from 'threads';
import rootlog from 'loglevel';

// The precision to round result coordinates to.
// Basically, this can be thought of the size of the "pixels" or a "grid" that the result polygons are inscribed into.
const PRECISION = 1.0e-6;

export default async function createView(model, viewAxis) {
	let _model = model;
	model = {};
	for (let id in _model) {
		model[id] = _model[id]
			.map(tri => tri.map(vertex => vertex.map(coord => Math.round(coord / PRECISION) * PRECISION)))
			// Fuse and filter out triangles that have collapsed
			.map(tri => fuse(tri, PRECISION**2))
			.filter(poly => poly.length >= 3);
	}
	
	// @todo Remove torpedo protection

	// Factory function for spawning worker threads
	const pool = Pool(() => spawn(new Worker('./occlude-worker.js')));
	for (let id in model) {
		// Queue occlusion for all pieces present in the armor model.
		// The arrow function will be run when the task is de-queued, meaning it will receive
		// any updates to model from previous tasks.
		pool.queue(async occludePiece => model[id] = await occludePiece(model[id], model, viewAxis));
	}
	// Wait for all tasks to complete
	await pool.completed();
	// Terminate the pool (destroy its threads)
	await pool.terminate();

	for (let id in model)
		model[id] = model[id].map(tri => convertDown(tri, viewAxis));

	for (let id in model) {
		let piece = model[id];
		let result = polybool.segments({
			regions: [],
			inverted: false
		});
		piece = piece
				// Round all coordinates to a precision of PRECISION
				// This is necessary because otherwise polybooljs tends to generate errors on vertices that are very close together,
				// but not identical
				.map(tri => tri.map(([ x, y ]) => [ Math.round(x / PRECISION) * PRECISION, Math.round(y / PRECISION) * PRECISION ]))
				// Fuse and filter out triangles that have collapsed
				.map(tri => fuse(tri, PRECISION**2))
				.filter(poly => poly.length >= 3);

		for (let tri of piece) {
			tri = {
				regions: [ tri ],
				inverted: false
			};
			try {
				result = polybool.selectUnion(polybool.combine(result, polybool.segments(tri)));
			} catch (err) {
				// @todo Find better error recovery for zero-length segment errors when unioning
				// 
				// What might work: 
				// 1. Manually calculate intersections and insert them into both polygons
				// 2. Round intersections to PRECISION, i.e. align them with the grid
				// 3. Retry
				if (err.message.match(/zero-length/i))
					rootlog.error(`Ignored polygon because of a zero-length error`);
				else 
					throw err;
			}
		}
		model[id] = polybool.polygon(result).regions;
	}

	return model;
}