import { dist2, contains } from 'geometry-3d/2d';

const EPSILON = 1.0e-8;

// Constants to describe the mode of coincident vertices on chains of shared edges.
// See Foster et al. p. 5
export const LEFT_ON = 1;
export const RIGHT_ON = 2;
export const ON_ON = 3;
export const ON_LEFT = 4;
export const ON_RIGHT = 5;

// Constants to describe where a point lies with respect to an edge/a chain of edges
export const LEFT = +1;
export const RIGHT = -1;

// Constants to describe whether an intersection is crossing or bouncing
export const CROSSING = true;
export const BOUNCING = false;

// Like Math.sign, but with an epsilon-interval around zero.
function sign(x) { return Math.abs(x) < EPSILON ? 0 : Math.sign(x) }

// Helper function that determines the position of a point with respect to the polygonal chain P1, P2, P3
// 
// Returns 
// 	LEFT if the point is to the left of P1P2 and P2P3
// 	RIGHT if the point is to the right of P1P2 and P2P3
// See Foster et al. p4
function side(Q, P1, P2, P3) {
	Q = Q.vertex; P1 = P1.vertex; P2 = P2.vertex; P3 = P3.vertex;

	const s1 = area(Q, P1, P2);
	const s2 = area(Q, P2, P3);
	const s3 = area(P1, P2, P3);

	switch (sign(s3)) {
		case +1: return s1 > 0 && s2 > 0 ? LEFT : RIGHT;
		case  0: return s1 > 0 ? LEFT : RIGHT;
		case -1: return s1 > 0 || s2 > 0 ? LEFT : RIGHT;
	}
}

// Calculates the signed area of the two-dimensional triangle pqr.
function area(p, q, r) {
	return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
}

/**
 * @typedef VertexEntry
 * A data structure that holds a vertex in `vertex` and its associated metadata in assorted other keys.
 */

/**
 * Calculates the pair-wise intersections between the edges of `subject` and `clip`, and inserts
 * them into both as new vertex entries. Intersection vertex entries will have an `intersection` flag set
 * in their metadata, as well as a `corresponding` flag that points to this intersection vertex entry in the
 * resp. other polygon.
 * @param  {VertexEntry[]} subject     The subject polygon's vertex entries.
 * @param  {VertexEntry[]} clip        The clip polygon's vertex entries.
 * @return {Object}               `{ subject, clip }`.
 */
export function interconnect(subject, clip) {
	function insertionIndex(poly, start, alpha) {
		// Loop over the entries, trying to find one that is either a source vertex or whose alpha value is higher than the given
		do {
			start = (start + 1) % poly.length;
		} while (!poly[start].source && poly[start].alpha < alpha)
		// Insert at the end rather than at the beginning
		return start || poly.length;
	}
	// Mark all original vertices in subject and clip
	subject = subject.map(vertex => ({ ...vertex, source: true }));
	clip = clip.map(vertex => ({ ...vertex, source: true }));

	for (let i = 0; i < subject.length; i++) {
		for (let j = 0; j < clip.length; j++) {
			// Find pCurr, pNext, qCurr, and qNext as the next pairs of SOURCE vertices in subject and clip
			let pCurr = subject[i];
			if (!pCurr.source)
				continue;

			let pNext;
			for (let k = 1; k < subject.length; k++) {
				pNext = subject[(i + k) % subject.length];
				if (pNext.source)
					break;
			}

			let qCurr = clip[j];
			if (!qCurr.source)
				continue;

			let qNext;
			for (let k = 1; k < clip.length; k++) {
				qNext = clip[(j + k) % clip.length];
				if (qNext.source)
					break;
			}

			const apCurr = area(pCurr.vertex, qCurr.vertex, qNext.vertex);
			const apNext = area(pNext.vertex, qCurr.vertex, qNext.vertex);
			const aqCurr = area(qCurr.vertex, pCurr.vertex, pNext.vertex);
			const aqNext = area(qNext.vertex, pCurr.vertex, pNext.vertex);

			let alpha;
			let beta;	

			if (Math.abs(apCurr - apNext) > EPSILON) {
				// The lines are NOT parallel.
				// 
				// They intersect in a point I = Pcurr + alpha * (Pnext - Pcurr) = Qcurr + beta * (Qnext - Qcurr).
				// Calculate alpha and beta from the signed areas of the triangles. This works because the (signed) area of the triangle
				// is the product of the base and the height; since the base is the same for apCurr and apNext the ratio of the partial
				// height to the sum of both heights is equal to the ratio of the areas:
				// 		alpha = height(pCurr, qCurr, qNext) / (height(pCurr, qCurr, qNext) - height(pNext, qCurr, qNext)) 
				// 			  = height(pCurr, qCurr, qNext) / (height(pCurr, qCurr, qNext) - height(pNext, qCurr, qNext)) * 1
				// 			  = height(pCurr, qCurr, qNext) / (height(pCurr, qCurr, qNext) - height(pNext, qCurr, qNext)) * base / base
				// 			  = (base * height(pCurr, qCurr, qNext)) / (base * (height(pCurr, qCurr, qNext) - height(pNext, qCurr, qNext)))
				// 			  = (base * height(pCurr, qCurr, qNext)) / (base * height(pCurr, qCurr, qNext) - base * height(pNext, qCurr, qNext))
				// 			  =	apCurr / (apCurr - apNext) 
				alpha = apCurr / (apCurr - apNext);
				beta = aqCurr / (aqCurr - aqNext); // aqCurr === aqNext iff apCurr === apNext, which we already know is not the case.

				if (EPSILON <= alpha && alpha < 1 && EPSILON <= beta && beta < 1) {
					// "True/normal" intersection
					// 
					const isect = [
						pCurr.vertex[0] + alpha * (pNext.vertex[0] - pCurr.vertex[0]),
						pCurr.vertex[1] + alpha * (pNext.vertex[1] - pCurr.vertex[1])
					];
					const pNew = { 
						vertex: isect, 
						intersection: true,
						alpha
					};
					subject.splice(insertionIndex(subject, i, alpha), 0, pNew);
					const qNew = { 
						vertex: isect, 
						intersection: true,
						alpha: beta
					}
					clip.splice(insertionIndex(clip, j, beta), 0, qNew);
					pNew.corresponding = qNew;
					qNew.corresponding = pNew;
				} else if (Math.abs(alpha) < EPSILON && EPSILON <= beta && beta < 1) {
					// pCurr is on the edge (qCurr, qNext)
					const qNew = {
						vertex: pCurr.vertex,
						intersection: true,
						alpha: beta,
						corresponding: pCurr
					};
					clip.splice(insertionIndex(clip, j, beta), 0, qNew);
					pCurr.intersection = true;
					pCurr.corresponding = qNew;
				} else if (EPSILON <= alpha && alpha < 1 && Math.abs(beta) < EPSILON) {
					// qCurr is on the edge (pCurr, pNext)
					const pNew = {
						vertex: qCurr.vertex,
						intersection: true,
						alpha,
						corresponding: qCurr
					};
					subject.splice(insertionIndex(subject, i, alpha), 0, pNew);
					qCurr.intersection = true;
					qCurr.corresponding = pNew;
				} else if (Math.abs(alpha) < EPSILON && Math.abs(beta) < EPSILON) {
					// subject and clip touch in the vertex pCurr === qCurr
					pCurr.intersection = true;
					pCurr.corresponding = qCurr;
					qCurr.intersection = true;
					qCurr.corresponding = pCurr;
				}
			} else if (Math.abs(apCurr) < EPSILON) {
				// They are COLLINEAR, and may overlap.
				// Because they are collinear, we can find alpha and beta such that 
				// 		qCurr = pCurr + alpha (pNext - pCurr)
				// 		pCurr = qCurr + beta (qNext - qCurr)
				// If 0 <= alpha < 1 or 0 <= beta < 1 we have an overlap
				let dim = Math.abs(pNext.vertex[0] - pCurr.vertex[0]) > Math.abs(pNext.vertex[1] - pCurr.vertex[1]) ? 0 : 1;
				alpha = (qCurr.vertex[dim] - pCurr.vertex[dim]) / (pNext.vertex[dim] - pCurr.vertex[dim]);
				beta = (pCurr.vertex[dim] - qCurr.vertex[dim]) / (qNext.vertex[dim] - qCurr.vertex[dim]);

				// Do an early check if the intersection is out of bounds. Note that for overlaps, it is enough if it is in
				// bounds for ONE of the segments.
				if ((alpha < 0 || alpha >= 1) && (beta < 0 || beta >= 1))
					continue;

				if (EPSILON <= alpha && alpha < 1 && EPSILON <= beta && beta < 1) {
					// pCurr lies on the edge (qCurr, qNext) and vice versa
					// Insert each into the other
					const pNew = { 
						vertex: qCurr.vertex, 
						intersection: true,
						alpha,
						corresponding: qCurr
					};
					subject.splice(insertionIndex(subject, i, alpha), 0, pNew);
					const qNew = { 
						vertex: pCurr.vertex,
						intersection: true,
						alpha: beta,
						corresponding: pCurr
					};
					clip.splice(insertionIndex(clip, j, beta), 0, qNew);

					pCurr.intersection = true;
					pCurr.corresponding = qNew;
					qCurr.intersection = true;
					qCurr.corresponding = pNew;
				} else if ((alpha < 0 || alpha >= 1) && EPSILON <= beta && beta < 1) {
					// pCurr lies on (qCurr, qNext), but qCurr does not lie on (pCurr, pNext)
					// Insert pCurr into (qCurr, qNext)
					const qNew = {
						vertex: pCurr.vertex,
						intersection: true,
						alpha: beta,
						corresponding: pCurr
					};
					clip.splice(insertionIndex(clip, j, beta), 0, qNew);
					pCurr.intersection = true;
					pCurr.corresponding = qNew;
				} else if (EPSILON <= alpha && alpha < 1 && (beta < 0 || beta >= 1)) {
					// qCurr lies on (pCurr, pNext), but pCurr does not lie on (qCurr, qNext)
					// Insert qCurr into (pCurr, pNext)
					const pNew = {
						vertex: qCurr.vertex,
						intersection: true,
						alpha,
						corresponding: qCurr
					};
					subject.splice(insertionIndex(subject, i, alpha), 0, pNew);
					qCurr.intersection = true;
					qCurr.corresponding = pNew;
				} else if (Math.abs(alpha) < EPSILON && Math.abs(beta) < EPSILON) {
					pCurr.intersection = true;
					pCurr.corresponding = qCurr;
					qCurr.intersection = true;
					qCurr.corresponding = pCurr;
				}
			} else {
				// They are parallel, but not collinear. There can be no intersection.
				continue;
			}
		}
	}
	return { subject, clip }
}

/**
 * Classifies all intersection vertex entries in `subject` with respect to `clip` as entering (`entry`), exiting (`exit`) or both, according to the following rules:
 * 
 * - a **crossing** intersection is an entry if its predecessor in one polygon is outside the other polygon, and an exit otherwise
 * - an **exterior bouncing** intersection is neither an entry nor an exit
 * - an **interior bouncing** intersection is both an entry and an exit
 * - the start of a **delayed crossing** chain is an exit if the last vertex before the chain is inside the other polygon, and nothing otherwise
 * - the end of a **delayed crossing** chain is an entry if the last vertex before the chain is outside the other polygon, and nothing otherwise
 * - the start and end of a **delayed exterior bouncing** chain are neither entries nor exits
 * - the start of a **delayed interior bouncing** chain is an exit, and the end an entry
 *
 * This function works in-place.
 *
 * **Definitions:**
 * 
 * A **crossing** intersection is one whose predecessor and successor are on different sides of the edge through predecessor, intersection and
 * successor in `clip`. Otherwise, an intersection is **bouncing**.
 * ```
 * 
 *            /                       \ /
 * ----------X--------       ----------X-------+
 *          /
 *       crossing                  bouncing
 * ```
 * A **bouncing** intersection is **exterior** if its predecessor is outside `clip`, otherwise it is **interior**.
 * ```
 *                                    \ /              
 * ------------------+       ----------X-------+
 *                   |                         |        
 *     \   /         |                         |
 *      \ /          |                         |
 * ------X-----------+       ------------------+
 *  interior bounce           exterior bounce
 * ```
 * A **chain** is a series of consecutive intersection vertices. A **delayed crossing** chain is one where the last vertex before the chain and the first vertex
 * after the chain are on opposite sides of the respective vertices in `clip`. Otherwise, it is a **delayed bouncing** chain.
 * ``` 
 *            /                 \       /
 * ----X=====X--------       ----X=====X-------- 
 *    /
 *   delayed crossing         delayed bouncing
 * ```
 * A **delayed bouncing** chain is **exterior** if the last vertex before the chain is outside `clip`, **interior** otherwise.
 * ```
 *                                \     /              
 * ------------------+       ------X===X-------+
 *                   |                         |        
 *     \       /     |                         |
 *      \     /      |                         |
 * ------X===X-------+       ------------------+
 * interior delayed bounce   exterior delayed bounce
 * ```
 * @param  {VertexEntry[]} subject The polygon whose intersections to classify.
 * @param  {VertexEntry[]} clip    The polygon with respect to which to classify.
 */
export function label(subject, clip) {
	// Classify all intersections as ENTRY or EXIT, by performing the following sequence of steps:
	// 
	// a) Classify all intersections as CROSSING or BOUNCING.
	// 
	//            /                       \ /
	// ----------X--------       ----------X-------+
	//          /
	//       crossing                  bouncing
	// 
	// b) Classify all common segments' (chains) start vertices as X/ON, ON/ON, ON/X.
	// 
	//            /        
	// ----X=====X-------- 
	//    /
	//    
	// c) Classify all chain endpoints as (delayed) CROSSING or BOUNCING.
	// 
	//            /                 \       /
	// ----X=====X--------       ----X=====X-------- 
	//    /
	//   delayed crossing         delayed bouncing
	//   
	// d) Classify all crossing intersections as an ENTRY or an EXIT.
	//  
	//             / poly1
	//      entry /              |
	// ----------X-------+       | poly1 vertex order
	//          /        |       | 
	//         /   poly2 |       V
	//        /          |
	// ------X-----------+
	//      / exit   
	//      
	// e) Classify all INTERIOR bouncing intersections as both an ENTRY and an EXIT; and all EXTERIOR bounces as neither.     
	//
	//                                    \ /              
	// ------------------+       ----------X-------+
	//                   |                         |        
	//     \   /         |                         |
	//      \ /          |                         |
	// ------X-----------+       ------------------+
	//  interior bounce           exterior bounce
	//  

	subject.forEach((curr, index) => {
		if (curr.intersection) {
			// Get the points P+ and P- following and preceding the intersection in the subject polygon, 
			// and the same for the clip polygon
			let pPlus = subject[(index + 1) % subject.length];
			let pMinus = subject[(index - 1 + subject.length) % subject.length];
			index = clip.indexOf(curr.corresponding);
			let qPlus = clip[(index + 1) % clip.length];
			let qMinus = clip[(index - 1 + clip.length) % clip.length];
			// Check if this is an intersection or an overlap. 
			// Because all overlaps are represented as common edges after the intersection phase, we can
			// determine this by seeing if P+ is itself an intersection and is linked to either Q+ or Q-, and
			// analagously for P-.
			if ((pPlus.intersection && (pPlus.corresponding === qPlus || pPlus.corresponding === qMinus)) 
				|| (pMinus.intersection && (pMinus.corresponding === qPlus || pMinus.corresponding === qMinus))) {
				// We have an OVERLAP
				// Determine the type of (chain) intersection we have here:
				// With each edge, P, can either change from being to one side of Q, stay on Q, or diverge to one side again.
				if ((pPlus.corresponding === qPlus && pMinus.corresponding === qMinus) 
					|| (pPlus.corresponding === qMinus && pMinus.corresponding === qPlus)) {
					// P is ON Q on both sides of curr
					curr.chain = ON_ON;
				} else if ((pPlus.corresponding === qPlus && side(qMinus, pMinus, curr, pPlus) === RIGHT)
					|| (pPlus.corresponding === qMinus && side(qPlus, pMinus, curr, pPlus) === RIGHT)) {
					// P changes from being LEFT of Q to being ON Q at curr
					curr.chain = LEFT_ON;
				} else if ((pPlus.corresponding === qPlus && side(qMinus, pMinus, curr, pPlus) === LEFT) 
					|| (pPlus.corresponding === qMinus && side(qPlus, pMinus, curr, pPlus) === LEFT)) {
					// P changes from being RIGHT of Q to being ON Q at curr
					curr.chain = RIGHT_ON;
				} else if ((pMinus.corresponding === qMinus && side(qPlus, pMinus, curr, pPlus) === RIGHT)
					|| (pMinus.corresponding === qPlus && side(qMinus, pMinus, curr, pPlus) === RIGHT)) {
					// P changes from being ON Q to being LEFT of Q at curr
					curr.chain = ON_LEFT;
				} else if ((pMinus.corresponding === qMinus && side(qPlus, pMinus, curr, pPlus) === LEFT)
					|| (pMinus.corresponding === qPlus && side(qMinus, pMinus, curr, pPlus) === LEFT)) {
					// P changes from being ON Q to being RIGHT of Q at curr
					curr.chain = ON_RIGHT;
				}
			} else {
				// We have an INTERSECTION

				// The intersection is CROSSING (i.e. a "normal" edge cross) if Q- and Q+ lie on DIFFERENT sides
				// of the polygonal chain P-, curr, P+, and BOUNCING if they lie on the same side
				if (side(qMinus, pMinus, curr, pPlus) !== side(qPlus, pMinus, curr, pPlus)) {
					// CROSSING intersection
					curr.crossing = CROSSING;
				} else
					// BOUNCING intersection
					curr.crossing = BOUNCING;			
			}
		}
	});

	// Process overlaps by marking them as (delayed) crossings/bouncings
	let chainStart;
	subject.forEach(curr => {
		if (!curr.chain) return;

		switch (Math.sign(curr.chain - ON_ON)) {
			case -1: 
				// If we are at the beginning of a chain, remember it
				chainStart = curr;
				break;
			case 0:
				// If we are in the middle of a chain, do nothing
				break;
			case +1:
				// If we are at the end of a chain, mark the intersection as BOUNCING if the last vertex is
				// on the same side as the first vertex was, and as CROSSING if it is on the other side.
				curr.crossing = curr.chain - ON_ON === chainStart.chain ? BOUNCING : CROSSING;
				// Mark chainStart as the same 
				chainStart.crossing = curr.crossing;
				// Reset chainStartSide
				chainStart = undefined;
		}
	});

	// Now we can perform the final labeling stage for both polygons: marking each intersection as either 
	// an ENTRY or an EXIT or both.
	
	// Try to find a vertex that is not an intersection vertex to start the process.
	// This is necessary so the inside/outside test can be performed unambiguously.		
	let start = subject.findIndex(curr => !curr.intersection);
	// Check that a non-intersection vertex existed in the subject polygon.
	// If no such vertex existed, and every vertex is an ON/ON vertex, 
	// then subject and clip polygon are identical.
	if (start === -1 && subject.every(curr => curr.chain === ON_ON))
		throw new TypeError(`subject and clip are identical`);
	else 
		// Now either start is !== -1, meaning we already have a valid start vertex, or
		// start is not defined but not every vertex of the polygon is an ON/ON vertex.
		// Check which one it is:
		if (start === -1) {				
			// At this point, we know there is at least one vertex that is not an ON/ON vertex 
			// and thus adjacent to an edge that is not a shared edge.
			// Find that vertex.
			let start = subject.findIndex(curr => curr.chain !== ON_ON);
			// If it is a LEFT/ON or a RIGHT/ON vertex, move the start back one...
			if (subject[start].chain < ON_ON) 
				start = (start - 1 + subject.length) % subject.length;
			

			// Now we know for sure that the edge [start, start + 1] is not a shared edge.
			// Create a new virtual vertex halfway between on that edge and insert it into the polygon.
			start++;
			subject.splice(start, 0, {
				vertex: {
					x: (subject[start].vertex[0] + subject[(start + 1) % subject.length].vertex[0]) / 2,
					y: (subject[start].vertex[1] + subject[(start + 1) % subject.length].vertex[1]) / 2
				}
			});
		}

	// Now both subjectStart and clipStart are guaranteed to not be on a polygon's edge. 
	// So the inside/outside test can be performed unambiguously.
	// We can finally mark every intersection as entering or exiting.
	let inside;
	// Initialize inside status according to whether the first point is inside or outside the OTHER polygon
	inside = contains(clip.map(entry => entry.vertex), subject[start].vertex);

	for (let i = 0; i < subject.length; i++) {
		const curr = subject[(start + i) % subject.length];
		if (curr.crossing === CROSSING && !curr.chain) {
			// A "standard" intersection, i.e. a crossing intersection that is not part of a chain is an entry
			// if we are coming from the outside of the other polygon, and an exit if we are coming from the inside.
			// 
			//               
			//            /                     
			// ----------X-------+       ------------------+
			//          /        |                         |
			//                   |                         |
			//                   |                  /      |
			// ------------------+       ----------X-------+
			//                                    /
			//       entry                      exit
			//       
			curr[inside ? 'exit' : 'entry'] = true;
			// Toggle the inside/outside status
			inside = !inside;
		} else if (curr.crossing === BOUNCING && !curr.chain) {
			// A bouncing intersection that is not part of a chain is both an entry and an exit if we are inside
			// the other polygon (i.e. it is an interior bounce), and neither if we are on the outside (exterior bounce)
			//
			//                                  \ /
			// ------------------+       --------X---------+
			//                   |                         |
			//                   |                         |
			//        \ /        |                         |
			// --------X---------+       ------------------+
			//                                     
			//        both                    nothing
			//        
			if (inside) {
				curr.entry = curr.exit = true;
			}
			// The inside/outside status does not change when bouncing
		} else if (curr.crossing === CROSSING && curr.chain < ON_ON) {
			// The START of a delayed crossing chain is an exit if we are on the inside of the other polygon, and nothing
			// if we are on the outside
			//
			//             /                      
			// ------+====X------+       ------------------+
			//      /            |                         |
			//                   |                         |
			//                   |                   /     |
			// ------------------+       ------+====X------+
			//                                /   
			//      nothing                     exit
			//        
			if (inside)
				curr.exit = true;

			// Do not toggle inside/outside status, it will be done at the end of the chain
		} else if (curr.crossing === CROSSING && curr.chain > ON_ON) {
			// The END of a delayed crossing chain is an entry if we are on the outside of the other polygon, and nothing
			// if we are on the inside
			//
			//             /                      
			// ------X====+------+       ------------------+
			//      /            |                         |
			//                   |                         |
			//                   |                   /     |
			// ------------------+       ------X====+------+
			//                                /   
			//        entry                   nothing
			//        
			if (!inside)
				curr.entry = true;

			// Toggle the inside/outside status at the end of the chain
			inside = !inside;
		} else if (curr.crossing === BOUNCING && curr.chain < ON_ON) {
			// The START of delayed bouncing chain is an exit if we are on the inside of the other polygon, and nothing
			// if we are on the outside
			//
			//      \      /                      
			// ------+====X------+       ------------------+
			//                   |                         |
			//                   |                         |
			//                   |            \      /     |
			// ------------------+       ------+====X------+
			//                                    
			//      nothing                     exit
			//        
			if (inside)
				curr.exit = true;
			// The inside/outside status does not change when bouncing				
		} else if (curr.crossing === BOUNCING && curr.chain > ON_ON) {
			// The END of delayed bouncing chain is an entry if we are on the inside of the other polygon, and nothing
			// if we are on the outside
			//
			//      \      /                      
			// ------X====+------+       ------------------+
			//                   |                         |
			//                   |                         |
			//                   |            \      /     |
			// ------------------+       ------X====+------+
			//                                   
			//       nothing                   entry
			//        
			if (inside)
				curr.entry = true;
			// The inside/outside status does not change when bouncing				
		}
	}
}

/**
 * Scans `subject` for vertex entries that are marked as both an entry and an exit and splits them into two vertex entries,
 * with the first one marked as only an exit and the second one as only an entry. A new corresponding vertex entry is inserted
 * into `clip`.
 *
 * This function works in-place.
 * @param  {VertexEntry[]} subject The polygon to scan for hybrid entries.
 * @param  {VertexEntry[]} clip    The polygon in which to insert corresponding entries.
 */
export function splitHybrids(subject, clip) {
	for (let i = 0; i < subject.length; i++) {
		let curr = subject[i];
		if (curr.entry && curr.exit) {
			const corrSplit = { ...curr.corresponding };
			const split = {
				...curr,
				corresponding: corrSplit,
				exit: true,
				entry: false
			}
			curr.exit = false;
			// Insert new entries, pushing current one back by one (because it lets us get away with not having to do modulo the polygons' lengths)
			subject.splice(i, 0, split);
			clip.splice(clip.indexOf(curr.corresponding), 0, corrSplit);
			i++;
		}
	}
}

/**
 * Traces poly to find pairs of `entry` and `exit` vertices. If they are closer together than √MIN_LENGTH_SQ, their **corresponding** 
 * vertices are fused by setting both their `vertex` property to the entry vertex, and marking each as a fuse partner of the other by setting
 * the `fuse` property. 
 *
 * `poly` must not contain vertex entries that are marked as both `entry` and `exit`.
 * @param  {VertexEntry[]} poly          The polygon to trace. Not that no fusing will be done in this polygon, as only **corresponding** vertices are fused.
 * @param  {number} MIN_LENGTH_SQ  The **square** of the fusing threshold. Vertices whose squared distance is less than this will be fused.
 */
export function fuse(poly, MIN_LENGTH_SQ) {
	// Trace poly and fuse subsequent intersections' corresponding vertices if they are closer than √MIN_LENGTH_SQ
	//
	// Specifically, find pairs of entering and exiting intersections and check their distances. 
	// If they are close together, merge their CORRESPONDING vertices.
	// 
	// For example:
	// We are tracing clip. We find the entry and exit intersections. If they are close enough together,
	// fuse them in subject. 
	// 
	//             / poly                            / poly
	//	    entry /                                 /
	// ----------X-------+                 \       /
	//	        /        |                  \     /
	//	       /         |    ------->       \   /
	//	      /          |                    \ /
	// ------X-----------+                -----+----------+ (This "appendage" will be removed in the next step)
	//      / exit                            / entry & exit fused
	//      
	// Note that it isn't enough to just compare immediately successive vertices, because there might be any 
	// number of vertices in between when tracing poly1:
	// 
	//    poly \                                 \ poly
	//          \ entry                           \    
	// ----------X-------+                 \       \
	//            \      |                  \       \
	//	       +---+     |    ------->       \   +---+
	//	      /          |                    \ /
	// ------X-----------+                -----+----------+
	//      / exit                            / entry & exit fused
	
	const i0 = poly.findIndex(item => item.entry);
	if (i0  > -1) {
		let entry = null;
		for (let _i = 0; _i < poly.length; _i++) {
			const i = (i0 + _i) % poly.length;
			if (poly[i].exit && entry && dist2(poly[i].vertex, entry.vertex) < MIN_LENGTH_SQ) {
				// Fuse the entry and the exit in the other polygon
				poly[i].corresponding.vertex = entry.vertex;
				// In the other polygon, mark the entry and exit vertices as fuse partners
				poly[i].corresponding.fused = entry.corresponding;
				entry.corresponding.fused = poly[i].corresponding;
			}
			if (poly[i].entry) 
				entry = poly[i];
		}
	}
}

/**
 * Breaks `poly` into its constituent components at fused vertices.
 * ```
 *     +                           +
 *    / \     +                   / \            +
 *   /   \   / \     ------->    /   \          / \
 *  /     \ /   \               /     \        /   \
 * +-------+-----+             +-------+      +-----+
 *       fused                component 1   component 2
 * ```
 * @param  {VertexEntry[]} poly The polygon to break up.
 * @return {VertexEntry[][]}      An array of the resultant polygons.
 */
export function separate(poly) {
	// Break the polygons up at fused vertices. 
	// 
	//     +                           +
	//    / \     +                   / \            +
	//   /   \   / \     ------->    /   \          / \
	//  /     \ /   \               /     \        /   \
	// +-------+-----+             +-------+      +-----+
	//       fused                component 1   component 2
	//       
	// To do this, we trace the polygon vertex for vertex. When we hit a fused vertex, that means one of two things: Either the polygon must be broken
	// up at this vertex, i.e. we need to start a new result component, or we just finished a result component. We can tell which one it is by checking
	// the fused vertex's fuse partner: If it is the fused vertex which started the current result component, we just finished this result component. 
	// Thus, this algorithm works as follows:
	// 
	// - Trace the polygon vertex for vertex, adding vertices to the current result component.
	// - If the current vertex is a fused vertex, check if its fuse partner is the current result component's start. If it is, add the current result
	//   component to the result. Unshelve the topmost unfinished result component from the stack of unfinished result components and add the fused
	//   vertex to it.
	// - If the current vertex is a fused vertex, but its fuse partner is not the current result component's start, we need to start a new result component.
	//   Shelve the current result component on the stack of unfinished components. Start a new result component, and add the current vertex to it.	
	

	// A list of components which are the input polygon, broken up at fused vertices
	const result = [];
	// A stack of as yet incomplete result components
	const unfinished = [];
	// The current result component
	let current = [];
	// Trace the polygon vertex for vertex
	for (let i = 0; i < poly.length; i++) {		
		// p is the current polygon entry (i.e. vertex + metadata)
		let p = poly[i];
		// If p is a fused vertex...
		if (p.fused) {
			// Check if its fuse partner is the beginning of the current polygon.
			if (p.fused === current[0]) {
				// We just finished a result component.
				// Add the current result component (the one we have now finished) to the overall result.
				result.push(current);
				// Pop the topmost unfinished component from the stack to keep working on.
				current = unfinished.pop();
			} else {
				// We have encountered a "new" fused vertex and need to start a new component.
				// Push the current result component onto the stack as unfinished, and start a new component.
				unfinished.push(current);
				current = [];
			}			
		}
		// Add the current vertex to the current component.
		current.push(p);
	}
	// If the current polygon is not empty, also push it to the result.
	// (This happens anytime tracing did not start on a fused vertex)
	if (current.length > 0)
		result.push(current);
	return result;
}

/**
 * Cleans up the array of polygons by removing collinear vertices from them, and removing any polygon that does not
 * have at least three vertices after that.
 * @param  {VertexEntry[][]} polys The array of polygons to clean up.
 * @return {VertexEntry[][]}       The remaining polygons.
 */
export function clean(polys) {
	return polys
		.map(poly => poly.filter((curr, index, poly) => {
			const prev = poly[(index - 1 + poly.length) % poly.length];
			const next = poly[(index + 1) % poly.length];
			return Math.abs(area(prev.vertex, curr.vertex, next.vertex)) > EPSILON;			
		}))
		.filter(poly => poly.length >= 3)
}

export default function recover(subject, clip, MIN_LENGTH_SQ) {
	subject = subject.map(vertex => { vertex });
	clip = clip.map(vertex => { vertex });

	// Step 1: Calculate the pair-wise intersection points between subject and clip (the erroring polygon) and insert them
	// as new vertices into both
	({ subject, clip } = interconnect(subject, clip, MIN_LENGTH_SQ));

	// Step 2: Classify all intersections as ENTRY or EXIT
	try {
		label(subject, clip); 
		label(clip, subject);
	} catch (err) {
		// If the subject and clip are identical, subject is completely occluded.
		if (/identical/.test(err.message))
			return {
				subject: [],
				clip
			}
	}

	// In an intermediate step, split vertex entries that are both entries AND exits (happens on interior bounces). 
	// After this step, every intersection is marked as EITHER an entry OR an exit. 
	// This makes it easier to mark fuse partners and determine the vertex to use for fusing. Otherwise we would have
	// to involve some more complicated logic to e.g. resolve series of interior bounces etc.; for example:
	// ------X-----X------
	//      / \   / \
	//     /   \ /   \
	// ---X-----X-----X---
	splitHybrids(subject, clip);
	splitHybrids(clip, subject);

	// Step 3: Trace clip and subject and fuse subsequent intersections in the resp. other if 
	// they are closer than √MIN_LENGTH_SQ.
	fuse(subject, MIN_LENGTH_SQ);
	fuse(clip, MIN_LENGTH_SQ);	

	let [ subjects, clips ] = [ subject, clip ]
		// Step 4: Break the polygons up at fused vertices. 
		.map(separate)
		// Step 5: Clean up.
		// Remove collinear vertices, and polygons with less than three vertices.
		.map(clean)
		// Convert back to vertices
		.map(poly => poly.map(item => item.vertex));

	return {
		subject: subjects,
		clip: clips
	}
}