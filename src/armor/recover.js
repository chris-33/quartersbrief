import { dist2, contains } from 'geometry-3d/2d';

const EPSILON = 1.0e-8;

// Constants to describe the mode of coincident vertices on chains of shared edges.
// See Foster et al. p. 5
const LEFT_ON = 1;
const RIGHT_ON = 2;
const ON_ON = 3;
const ON_LEFT = 4;
const ON_RIGHT = 5;

// Constants to describe where a point lies with respect to an edge/a chain of edges
const LEFT = +1;
const RIGHT = -1;

// Constants to describe whether an intersection is crossing or bouncing
const CROSSING = true;
const BOUNCING = false;

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

export function recover(subject, clip, MIN_LENGTH_SQ) {
	subject = subject.map(vertex => { vertex });
	clip = clip.map(vertex => { vertex });

	// Step 1: Calculate the pair-wise intersection points between subject and clip (the erroring polygon) and insert them
	// as new vertices into both
	for (let i = 0; i < subject.length; i++) {
		for (let j = 0; j < clip.length; j++) {
			let pCurr = subject[i];
			let pNext = subject[(i + 1) % subject.length];
			let qCurr = clip[j];
			let qNext = clip[(j + 1) % clip.length];

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
			} else {
				// They ARE parallel, but they may still overlap.
				// If they do, we can find alpha and beta such that 
				// 		qCurr = pCurr + alpha (pNext - pCurr)
				// 		pCurr = qCurr + beta (qNext - qCurr)
				// 	Calculate alpha values for x and y coordinates. If they are (almost) equal, there is an overlap, and we have found our alpha.
				let alpha0 = (qCurr.vertex[0] - pCurr.vertex[0]) / (pNext.vertex[0] - pCurr.vertex[0]);
				let alpha1 = (qCurr.vertex[1] - pCurr.vertex[1]) / (pNext.vertex[1] - pCurr.vertex[1]);
				alpha = Math.abs(alpha1 - alpha0) < EPSILON ? alpha0 : undefined;

				let beta0 = (pCurr.vertex[0] - qCurr.vertex[0]) / (qNext.vertex[0] - qCurr.vertex[0]);
				let beta1 = (pCurr.vertex[1] - qCurr.vertex[1]) / (qNext.vertex[1] - qCurr.vertex[1]);
				beta = Math.abs(beta1 - beta0) < EPSILON ? beta0 : undefined;
			}

			// If the intersection is outside of the bounds of the segments [pCurr, pNext) and [qCurr, qNext),
			// disregard it
			if (alpha < 0 || alpha >= 1 || beta < 0 || beta >= 1)
				continue;

			const isect = [
				pCurr.vertex[0] + alpha * (pNext.vertex[0] - pCurr.vertex[0]),
				pCurr.vertex[1] + alpha * (pNext.vertex[1] - pCurr.vertex[1])
			];

			// Unless the intersection happens at (near) the start point, insert it.
			// If it does happen at the start point, replace the start point with isect			
			if (dist2(isect, pCurr) >= MIN_LENGTH_SQ) {			
				// Insert isect into subject after pCurr and set pCurr to the inserted entry
				i++;
				subject.splice(i, 0, { vertex: isect });
				pCurr = subject[i];
			} else {
				pCurr.vertex = isect;
			}

			if (dist2(isect, qCurr) >= MIN_LENGTH_SQ) {
				// Insert isect into clip after qCurr and set qCurr to the inserted entry
				j++;
				clip.splice(j, 0, { vertex: isect });
				qCurr = clip[j];
			} else {
				qCurr.vertex = isect;
			}

			pCurr.intersection = true;
			pCurr.corresponding = qCurr;
			qCurr.intersection = true;
			qCurr.corresponding = pCurr;
		}
	}

	// Step 2: Classify all intersections as ENTRY or EXIT, by performing the following sequence of steps:
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
	//            /                       \ /              
	// ----------X-------+       ----------X-------+
	//          /        |                         |        
	//     \   /         |                         |
	//      \ /          |                         |
	// ------X-----------+       ------------------+
	//  interior bounce           exterior bounce
	//  

	subject.forEach(curr => {
		if (curr.intersection) {
			// Get the points P+ and P- following and preceding the intersection in the subject polygon, 
			// and the same for the clip polygon
			let pPlus = curr.next;
			let pMinus = curr.prev;
			let qPlus = curr.corresponding.next;
			let qMinus = curr.corresponding.prev;
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

		switch (sign(curr.chain - ON_ON)) {
			case -1: 
				// If we are at the beginning of a chain, remember it
				chainStart = curr;
				break;
			case 0:
				// If we are in the middle of a chain, do nothing
				break;
			case +1:
				// If we are at the end of a chain, mark the intersection as BOUNCING if the last vertex is
				// on the same side as the first vertex was, and as CROSSING if it is on the clip side.
				curr.crossing = curr.chain - ON_ON === chainStart.chain ? BOUNCING : CROSSING;
				// Mark chainStart as the same 
				chainStart.crossing = curr.crossing;
				// Reset chainStartSide
				chainStart = undefined;
		}
	});

	// At this point, all of the intersection vertices of the subject polygon are marked as either
	// CROSSING or BOUNCING, or have a delayed flag.
	// Copy those labels over to the clip polygon, because the clip polygon crosses the subject at an 
	// intersection iff the subject crosses the clip.
	subject.forEach(curr => {
		if (curr.intersection) {
			curr.corresponding.crossing = curr.crossing;
			curr.corresponding.delayed = curr.delayed;
		}
	});

	// Now we can perform the final labeling stage for both polygons: marking each intersection as either 
	// an ENTRY or an EXIT or both.
	
	// For both polygons, try to find a vertex that is not an intersection vertex to start the process.
	// This is necessary so the inside/outside test can be performed unambiguously.		
	//
	// See Foster et al. p. 6			
	let [ subjectStart, clipStart ] = [ subject, clip ].map(poly => poly.findIndex(curr => !curr.intersection));
	// Check that a non-intersection vertex existed in the subject polygon.
	// If no such vertex existed, and every vertex is an ON/ON vertex, 
	// then subject and clip polygon are identical, and the subject is completely occluded.
	if (subjectStart === -1 && subject.every(curr => curr.chain === ON_ON))
		return [];
	else [ subjectStart, clipStart ] = [ 
		{ start: subjectStart, poly: subject },
		{ start: clipStart, poly: clip }
	].map(({ start, poly }) => {
		// Now either start is defined, meaning we already have a valid start vertex, or
		// start is not defined but not every vertex of the polygon is an ON/ON vertex.
		if (start === -1) {				
			// At this point, we know there is at least one vertex that is not an ON/ON vertex 
			// and thus adjacent to an edge that is not a shared edge.
			// Find that vertex.
			let start = poly.findIndex(curr => curr.chain !== ON_ON);
			// If it is a LEFT/ON or a RIGHT/ON vertex, move the start back one...
			if (poly[start].chain < ON_ON) 
				start = (start - 1 + poly.length) % poly.length;
			

			// Now we know for sure that the edge [start, start + 1] is not a shared edge.
			// Create a new virtual vertex halfway between on that edge and insert it into the polygon.
			start = {
				vertex: {
					x: (poly[start].vertex[0] + poly [(start + 1) %poly.length].vertex[0]) / 2,
					y: (poly[start].vertex[1] + poly [(start + 1) %poly.length].vertex[1]) / 2
				}
			};
			poly.splice((start + 1) % poly.length, 0, start);
		}
		return start;
	});

	// Now both subjectStart and clipStart are guaranteed to not be on a polygon's edge. 
	// So the inside/outside test can be performed unambiguously.
	// We can finally mark every intersection as entering or exiting.
	[ 
		{ start: subjectStart, poly: subject, other: clip },
		{ start: clipStart, poly: clip, other: subject } 
	].forEach(({ start, poly, other }) => {
		let inside;
		// Initialize inside status according to whether the first point is inside or outside the OTHER polygon
		inside = contains(poly[start].vertex, other.map(entry => entry.vertex));

		for (let i = 0; i < poly.length; i++) {
			const curr = poly[(start + i) % poly.length];
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
				//        both                    neither
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
	});

	// Step 3: Trace clip and subject and fuse subsequent intersections in the resp. other if 
	// they are closer than MIN_LENGTH
	//
	// Specifically, find pairs of entering and exiting intersections in one polygon and check their
	// distances. If they are close together, merge them in the OTHER polygon.
	// For example:
	// We are tracing poly1. We find the entry and exit intersections. If they are close enough together,
	// fuse them in poly2. 
	// 
	//             / poly1                           / poly1
	//	    entry /                                 /
	// ----------X-------+                 \       /
	//	        /        |                  \     /
	//	       /   poly2 |    ------->       \   /
	//	      /          |              poly2 \ /
	// ------X-----------+                -----+----------+ (This "appendage" will be removed in the next step)
	//      / exit                            / entry & exit fused
	//      
	// Note that it isn't enough to just compare immediately successive vertices, because there might be any 
	// number of vertices in between when tracing poly1:
	// 
	//   poly1 \                                 \ poly1
	//          \ entry                           \    
	// ----------X-------+                 \       \
	// poly2      \      |                  \       \
	//	       +---+     |    ------->       \   +---+
	//	      /          |              poly2 \ /
	// ------X-----------+                -----+----------+
	//      / exit                            / entry & exit fused
	//      
	
	[ subject, clip ].forEach(poly => {
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
	});

	// Step 4: Split the polygons at fused vertices.
	// 
	// Trace the polygon, adding vertices to the current component
	// When we hit a fuse pair, start a new component and shelve the current one as unfinished
	// When the current component is complete, add it to the list of result polygons and unshelve the previous unfinished polygon 
	// A component is complete when we hit the fuse partner of its first vertex, or we have exhausted the input polygon (only for the very first result component)
	let [ subjects, clips ] = [ subject, clip ].map(poly => {
		const result = [];
		const unfinished = [];
		let current = [];
		for (let i = 0; i < poly.length; i++) {		
			let p = poly[i];
			if (p.fused) {
				if (p.fused === current[0]?.fused) {
					result.push(current);
					current = unfinished.pop();
				} else {
					unfinished.push(current);
					current = [];
				}			
			}
			current.push(p);
		}
		result.push(current);		
		return result;
	})
}