import * as Vector from 'geometry-3d/vector';
import * as geom from 'geometry-3d';
import polybool from 'polybooljs';
import rootlog from 'loglevel';

const dedicatedlog = rootlog.getLogger('Projector');

// A special epsilon for use when use when trying to see if vectors are perpendicular. The normal epsilon
// is then MUCH too large: Math.cos(89.5 * Math.PI/180) === 0.00872...
export const MAX_ANGLE = 89.5;
// How long a segment can be in zero-length recovery before it is fused
export const MIN_LENGTH  = 1.0e-6


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
			dedicatedlog.debug(`Removed triangle ${i} because it was at angle ${Math.acos(Vector.dot(normal, view) / (Vector.length(normal) * Vector.length(view))) * 180/Math.PI} to the view vector\n`);
			continue;
		}

		// Create the list of occlusion polygons
		// This is done by projecting all triangles of other onto T's plane and then subtracting them from T
		let occlusions = other
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
			// .filter(large)
			.map(poly => ({
				inverted: false,
				regions: [ poly ]
			}));
	
		// Convert T into polybooljs' format
		T = {
			regions: [ geom.convertDown(T, axis) ], 
			inverted: false
		};

		// Since we will be performing a sequence of operations on T, we will use the core API of polybooljs
		// for efficiency reasons. See https://www.npmjs.com/package/polybooljs?activeTab=readme#advanced-example-1
		// 
		// Convert T to a list of segments.
		let segments = polybool.segments(T);
		let errorPolys = [];
		// Convert every polygon in occlusions to segments, intersect them with T's segments and select
		// the subtraction.
		for (let poly of occlusions) {
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