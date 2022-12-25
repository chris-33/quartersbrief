import * as Vector from 'geometry-3d/vector';
import * as geom from 'geometry-3d';
import polybool from 'polybooljs';
import recover from './recover.js';
import rootlog from 'loglevel';

const dedicatedlog = rootlog.getLogger('Projector');

// At what angle to consider a triangle perpendicular to the view plane
export const MAX_ANGLE = 89.5;
// How long a segment can be in zero-length recovery before it is fused
export const MIN_LENGTH  = 1.0e-6

// How many times to attempt error recovery before giving up
export const MAX_RETRIES = 3;

const ANGLE_EPSILON = Math.cos(MAX_ANGLE * Math.PI/180) ** 2;
const MIN_LENGTH_SQ = MIN_LENGTH ** 2;


export default function occlude(subject, other, viewAxis) {
	const view = [0,1,2].map(dim => dim === viewAxis ? 1 : 0);
	let i = 0;

	while (i < subject.length) {
		dedicatedlog.debug(`Checking triangle ${i} of mesh ${subject.id} against mesh ${other.id}`);

		// The triangle of the subject we are currently handling
		let T = subject[i];
		// That triangle's normal vector and distance from zero. 
		// Together these describe the triangle's plane
		const normal = geom.normal(T);
		const d = Vector.dot(normal, T[0]);

		// Find the largest coordinate of T's normal vector. This is the dimension in which T is smallest.
		// It follows that out of all axis-aligned projections of T, this is the one with the largest area. (This will
		// improve accuracy.)
		// Note that depending on T's orientation in the 3D space, axis need not be the same as the view axis.
		const axis = [ 0, 1, 2 ].reduce((prev, curr) => Math.abs(normal[curr]) >= Math.abs(normal[prev]) ? curr : prev);

		// Do a preliminary check to see if T is (almost) perpendicular to the view axis.
		// If it is, we can remove it and save a lot of expensive computations.
		// In addition, if it is ALMOST perpendicular, its projection along the view axis will be very small,
		// and this tends to make the computations numerically unstable.
		//
		// Remove T if its angle to the view vector is close to 90 degrees
		if (Math.abs(Vector.dot(normal, view)) < ANGLE_EPSILON) {
			// Remove T and do not increase i
			subject.splice(i, 1);
			// Normally we wouldn't do this, but constructing the log message involves two calls to Math.sqrt and one to Math.acos, all of which are expensive operations.
			if (dedicatedlog.getLevel() <= dedicatedlog.levels.DEBUG)
				dedicatedlog.debug(`Removed triangle ${i} because it was at angle ${Math.acos(Vector.dot(normal, view) / (Vector.length(normal) * Vector.length(view))) * 180/Math.PI} to the view vector\n`);
			continue;
		}

		// Create the list of occlusion polygons
		// This is done by projecting all triangles of other onto T's plane and then subtracting them from T
		let occluders = other
			// Do not occlude T with itself, because the result would always be empty
			// (This will happen when checking a mesh against itself)
			.filter(tri => tri !== T)
			// Do not occlude with triangles that are (almost) perpendicular to the view axis.
			// Their impact would be negligible, and the computations tend to be numerically unstable.
			.filter(tri => Math.abs(Vector.dot(geom.normal(tri), view)) > ANGLE_EPSILON)
			// Project onto T's plane along the view axis
			.map(tri => {
				let selector = Vector.dot(normal, view) > 0 ? 'above' : 'below';
				tri = geom.cut(tri, normal, d)[selector];
				if (tri.length > 0)
					tri = geom.project(tri, normal, d, viewAxis);
				return tri;
			})
			// Reduce to 2D in the same dimensions as for T. 
			.map(poly => geom.convertDown(poly, axis))
			.map(poly => geom.fuse(poly, MIN_LENGTH_SQ))
			.filter(poly => poly.length >= 3)
			.map(poly => ({
				inverted: false,
				regions: [ poly ]
			}));
	
		// Convert T into polybooljs' format
		T = {
			regions: [ geom.convertDown(T, axis) ], 
			inverted: false
		};

		let errorPolys;
		let retries = MAX_RETRIES;
		do {
			errorPolys = [];
			retries--;

			// Since we will be performing a whole sequence of operations on T, we will use the core API of polybooljs
			// for efficiency reasons. See https://www.npmjs.com/package/polybooljs?activeTab=readme#advanced-example-1
			// 
			// Convert T to a list of segments.
			let segments = polybool.segments(T);
			// Convert every polygon in occluders to segments, intersect them with T's segments and select
			// the subtraction.
			for (let poly of occluders) {
				try {
					let polySegments = polybool.segments(poly);
					let combined = polybool.combine(segments, polySegments);
					segments = polybool.selectDifference(combined);
					if (segments.segments.length === 0) {
						dedicatedlog.debug(`The triangle is completely occluded`);
						// We can stop now, because there is nothing left to subtract further occluders from
						break;
					}
				} catch(err) {
					// Sometimes polybooljs will throw a "zero-length segment" error. According to the docs, this happens
					// when the epsilon it uses for floating-point comparisons is "either too large or too small". (See
					// https://www.npmjs.com/package/polybooljs?activeTab=readme#epsilon)
					// 
					// Since this is not terribly helpful in choosing a more appropriate epsilon, we will just collect all
					// error-generating occluders and deal with them separately later.
					errorPolys.push(poly);
				}
			}
			dedicatedlog.debug(`Polygon ${i} generated ${errorPolys.length || 'no'} errors`);
	
			// Convert segments back to a polygon
			T = polybool.polygon(segments);
	
			if (errorPolys.length > 0) {
				for (let i = 0; i < T.regions.length; i++) {
					for (let j = 0; j < errorPolys.length; j++) {
						let recovered = recover(T.regions[i], errorPolys[j].regions[0]);
						// Filter out very small polygons from the results of recover().
						// This is in preparation of the next round of the main loop. 
						recovered.subject = recovered.subject
							.map(poly => geom.fuse(poly, MIN_LENGTH_SQ))
							.filter(poly => poly.length >= 3);
						recovered.clip = recovered.clip
							.map(poly => geom.fuse(poly, MIN_LENGTH_SQ))
							.filter(poly => poly.length >= 3);

						// Replace the currently recovered region of T with the results of the recovery (this may be several polygons)
						T.regions.splice(i, 1, ...recovered.subject);
						// If recovery made the current region vanish, continue with the outer loop
						if (recovered.subject.length === 0) {
							// Make sure we don't skip an element after deletion
							i--;
							break;
						}
						errorPolys[j].regions = recovered.clip;
					}
				}
				dedicatedlog.debug(`Retrying polygon ${i} with ${T.regions.length} parts and ${errorPolys.reduce((sum, poly) => sum += poly.regions.length, 0)} occluders`);
				occluders = errorPolys;
			}
		} while (errorPolys.length > 0 && retries > 0);

		if (retries === 0) dedicatedlog.debug(`Gave up error recovery for polygon ${i} after ${MAX_RETRIES} attempts`);

		T = T.regions
			.map(region => geom.fuse(region, MIN_LENGTH_SQ))
			.filter(region => region.length >= 3)
			// Extrude T from its axis-aligned state back onto the original triangle's plane
			.map(region => geom.project(geom.convertUp(region, axis), normal, d, axis))
			// Break the result up into triangles again for further processing
			.flatMap(geom.triangulate)
		dedicatedlog.debug(`Broken up into ${T.length} triangles`);

		// Replace T with its remaining triangles in subject.
		subject.splice(i, 1, ...T);
		/// For the next iteration, skip all triangles we just inserted.
		i += T.length;
	}
	return subject;
}