import { readFileSync } from 'fs';
import clone from 'clone';
import deepequal from 'deep-equal';
import occlude, { MIN_LENGTH, MAX_RETRIES } from '../../src/armor/occlude.js';
import sinon from 'sinon';
import esmock from 'esmock';

describe('occlude', function() {
	const X = 0;
	const Y = 1;
	const Z = 2;

	const z = ([x,y]) => 2 * x + 3 * y + 4;
	let TEST_DATA;
	let subject;

	let minX, maxX, midX, width, 
		minY, maxY, midY, height,
		minZ, maxZ, midZ;

	before(function() {
		TEST_DATA = JSON.parse(readFileSync('test/armor/testdata/occlude-subject.json'));
	});

	beforeEach(function() {
		subject = clone(TEST_DATA).map(tri => tri.map(vertex => [ ...vertex, z(vertex) ]));
	});

	beforeEach(function() {
		minX = Math.min(...subject.flat().map(vertex => vertex[X]));
		maxX = Math.max(...subject.flat().map(vertex => vertex[X]));
		midX = (minX + maxX) / 2;
		width = maxX - minX;

		minY = Math.min(...subject.flat().map(vertex => vertex[Y]));
		maxY = Math.max(...subject.flat().map(vertex => vertex[Y]));
		midY = (minY + maxY) / 2;
		height = maxY - minY;

		minZ = Math.min(...subject.flat().map(vertex => vertex[Z]));
		maxZ = Math.max(...subject.flat().map(vertex => vertex[Z]));
		midZ = (minZ + maxZ) / 2;
	});

	it('should return an empty result if the subject mesh is completely behind the occluding mesh', function() {
		// Construct an occluding mesh that is larger than the subject and in front of it
		const occluder = subject.map(tri => tri.map(([ x, y ]) => [
			x <= midX ? x - 1 : x + 1,
			y <= midY ? y - 1 : y + 1
		]).map(vertex => [ ...vertex, maxZ + 1 ]));

		const result = occlude(subject, occluder, Z);
		expect(result).to.be.empty;
	});

	it.skip('should ??????? if the subject mesh is coplanar with the occluding mesh', function() {
		// We can't choose the one with the thicker armor, because we don't know armor thicknesses at this point - only piece ids.
		// But we could make piece ids an array and just remember both ids in this case. Then any algorithm reliant on occlude()
		// could pick whichever thickness is appropriate from this info.
		// 
		// From running the current state of things against the game files, this does not actually seem to be a problem. 
		expect.fail('Behavior when meshes are coplanar is not yet specified');
	});

	it('should return the subject mesh unchanged if it is completely in front of the occluding mesh', function() {
		// Construct an occluding mesh that is larger than the subject and in front of it
		const occluder = subject.map(tri => tri.map(([ x, y ]) => [
			x <= midX ? x - 1 : x + 1,
			y <= midY ? y - 1 : y + 1
		]).map(vertex => [ ...vertex, minZ - 1 ]));
		
		const expected = clone(subject); // occlude works in-place

		const result = occlude(subject, occluder, Z);
		expect(result).to.deep.equal(expected);
	});

	it('should return those parts of the subject mesh that are in front of the occluding mesh if they jut through each other', function() {
		// Visualization of subject S and occluder O
		//  
		//  Front view: 			Side view:
		//  
		// +-----------+			   |  		
		// |  +-----+  | 			   | / S
		// |  |     |  |			   |/  
		// |  |  S  |  | O       	   X
		// |  |     |  |			  /|
		// |  +-----+  |			 / | O
		// +-----------+		       | 
		// 
		// What we will check;
		// - The result of the occlusion is not empty
		// - Every vertex in the result is in front of (or on) O
		// - Those vertices of S that were in front of O are present in the result
		// - There are new vertices: vertices that are present in the result, but were not in S
		// - Those new vertices are on the intersection line of O and S
		subject = subject.map(tri => tri.map(([ x, y ]) => [ x, y, y ]));
		minZ = minY;
		maxZ = maxY;
		midZ = midY;
		const occluder = subject.map(tri => tri.map(([ x, y ]) => [
			x <= midX ? x - 1 : x + 1,
			y <= midY ? y - 1 : y + 1
		]).map(vertex => [ ...vertex, midZ ]));

		const result = occlude(clone(subject) /* occlude works in-place */, occluder, Z);
		expect(result).to.be.an('array').with.lengthOf.at.least(2); // Result should be a rectangle, so it should have been broken up into at least two triangles (but maybe more, depending on how triangulation worked)

		// Every vertex of the result should have a z-coordinate of at least midZ, which is the z-coordinate of the occluder
		result.forEach(tri => tri.forEach(vertex => expect(vertex[Z]).to.be.at.least(midZ)));

		// The result should include all vertices of the subject that were in front of the occluder
		expect(result.flat()).to.deep.include.members(subject.flat().filter(vertex => vertex[Z] >= midZ));

		// A list of vertices that were not present in the subject
		const inserted = result.flat().filter(vertex => subject.flat().every(otherVertex => !deepequal(vertex, otherVertex)));
		expect(inserted).to.not.be.empty;
		// Vertices should be on the intersection line:
		inserted.forEach(vertex => {
			expect(vertex[X]).to.be.at.least(minX).and.at.most(maxX);
			expect(vertex[Y]).to.equal(midY);
			expect(vertex[Z]).to.equal(midZ);
		});
	});
	
	it('should return the subject mesh unchanged if it is not obscured by the occluding mesh', function() {
		// Construct an occluding mesh that in front of the subject, but off to one side
		const occluder = subject.map(tri => tri.map(([ x, y ]) => [
			x + width,
			y
		]).map(vertex => [ ...vertex, Math.max(...subject.flat().map(vertex => vertex[Z])) + 1 ]));
		
		const expected = clone(subject); // occlude works in-place
		
		const result = occlude(subject, occluder, Z);
		expect(result).to.deep.equal(expected);
	});

	it('should return the remaining parts of the subject mesh  if it is only partially obscured by the occluding mesh', function() {
		// Construct an occluding mesh that is in front of the subject, but shifted halfway up the subject
		// The bottom half of the subject is unobscured, the top half is obscured
		const occluder = subject.map(tri => tri.map(([ x, y ]) => [
			x,
			y + height/2
		]).map(vertex => [ ...vertex, maxZ + 1 ]));
		const occluderBottom = Math.min(...occluder.flat().map(vertex => vertex[Y]));

		const result = occlude(clone(subject) /* occlude works in-place */, occluder, Z);
		expect(result).to.be.an('array').that.is.not.empty;

		// All vertices of the subject that were below the occluder's minimum Y coordinate should be present in the result
		expect(result.flat()).to.deep.include.members(subject.flat().filter(vertex => vertex[Y] <= occluderBottom));

		// Any vertices that were not present in the subject should be on the occluder's bottom edge
		const inserted = result.flat().filter(vertex => subject.flat().every(otherVertex => !deepequal(vertex, otherVertex)));
		expect(inserted).to.not.be.empty;
		inserted.forEach(vertex => expect(vertex[Y]).to.be.at.most(occluderBottom));
	});

	it('should remove triangles from the subject mesh that are perpendicular to the view axis', function() {
		const tri = [
			[ 3, 1 ],
			[ 3, 3 ],
			[ 3, 3 ]
		].map(([ x, y ]) => [ x, y, x + y ]);

		const result = occlude([ tri ], [], Z);
		expect(result).to.be.empty;
	});

	it('should not occlude with triangles from the occluding mesh that are perpendicular to the view axis', function() {
		const tri = [
			[ 3, 1 ],
			[ 3, 3 ],
			[ 3, 3 ]
		].map(([ x, y ]) => [ x, y, x + y ]);
		const expected = clone(subject);

		const result = occlude(subject, [ tri ], Z);
		expect(result).to.deep.equal(expected);
	});

	it('should remove triangles from the result if they have an edge that is less than the minimum length', function() {	
		subject = subject.map(tri => tri.map(([ x, y ]) => [ x, y , 1 ])); 	// Set all z-coordinates to 1 to have better control over the result instead of the "standard" 
																			// z coordinates used so far for all the other tests. 
																			// Otherwise it is hard to achieve desired edge length, because the internal projections done in
																			// occlude() are designed to maximize area, and therefore maximize edge length.
																			// Then the resultant length may end up larger than the threshold again.
		const occluder = subject.map(tri => tri.map(([ x, y ]) => [ x + MIN_LENGTH / 2, y, 2 ]));

		const result = occlude(subject, occluder, Z);
		expect(result).to.be.empty;
	});

	it('should work with any view axis', function() {
		[ X, Y, Z ].forEach(axis => {
			const [dim1,dim2] = [0,1,2].filter(dim => dim !== axis);
			// Construct an occluder that is above the subject's first triangle in the "axis" dimension and identical in the other dimensions
			const occluder = [ subject[0].map(vertex => Object.assign([], {
				[dim1]: vertex[dim1],
				[dim2]: vertex[dim2],
				[axis]: vertex[axis] + 1
			})) ];

			const result = occlude(clone(subject), occluder, axis);
			expect(result).to.deep.equal(subject.slice(1));
		});
	});

	describe('zero-length error recovery', function() {
		let recover;
		let polybool;
		let occlude;

		beforeEach(async function() {
			// Return subject and clip unchanged. It doesn't really matter what we return here, as long as neither is empty
			recover = sinon.stub().callsFake((subject, clip) => ({
				subject: [ subject ], clip: [ clip ]
			}));
			polybool = (await import('polybooljs')).default;
			// Fake a zero-length error on the first call
			sinon.stub(polybool, 'selectDifference')

			occlude = (await esmock('../../src/armor/occlude.js', {
				'../../src/armor/recover.js': { default: recover },
				'polybooljs': { default: polybool }
			})).default;
		});

		beforeEach(function() {
			// Use only one triangle of subject for these tests
			subject = subject.slice(0,1);			
		});

		afterEach(function() {
			polybool.selectDifference.restore();
		});

		it('should perform error recovery on zero-length errors', async function() {
			// Fake a zero-length error on the first call
			polybool.selectDifference
				.callThrough()
				.onFirstCall().throws(new TypeError('zero-length segment detected')); 

			// Construct an occluding mesh that in front of the subject, but off to one side
			const occluder = subject.map(tri => tri.map(([ x, y ]) => [
				x + width,
				y
			]).map(vertex => [ ...vertex, Math.max(...subject.flat().map(vertex => vertex[Z])) + 1 ]));

			const result = occlude(clone(subject), clone(occluder), Z); // occlude works in-place, so need to clone again

			expect(recover).to.have.been.called;
			// There should be subject.length * occluder.length calls for the first run, and one resulting from the retry after error recovery
			expect(polybool.selectDifference).to.have.callCount(subject.length * occluder.length + 1);

			expect(result).to.deep.equal(subject);
		});

		it('should retry occluding with the recovered polygons', function() {
			// Fake a zero-length error on the first call
			polybool.selectDifference
				.callThrough()
				.onFirstCall().throws(new TypeError('zero-length segment detected'));
			const occluder = clone(subject);
			// Make recover return two arbitrary polygons. It doesn't really matter what these are,
			// but they need to be different from the ones passed into recover()
			const recovered = {
				subject: [
					[ [ 0, 0 ], [ 1, 3 ], [ 0, 5 ] ]
				],
				clip: [
					[ [ -1, -1 ], [ -3, -3 ], [ -2, -4 ] ]
				]
			}
			recover.returns(recovered);

			// Construct what should be passed into selectDifference() if there is a retry following recovery
			const expected = polybool.combine(polybool.segments({
				regions: recovered.subject, inverted: false
			}), polybool.segments({
				regions: recovered.clip, inverted: false
			}));

			occlude(clone(subject), clone(occluder), Z); // occlude works in-place, so need to clone again

			expect(polybool.selectDifference).to.have.been.calledWith(expected);
		});

		it('should filter out very small subject polygons after error recovery', function() {
			// Fake a zero-length error on the first call
			polybool.selectDifference
				.callThrough()
				.onFirstCall().throws(new TypeError('zero-length segment detected')); 
			// Make recover return a subject polygon that has an undersize edge
			recover.callsFake(() => ({
				subject: [
					[ [ 1.0, 1.0 ], [ 1.0 + 0.5 * MIN_LENGTH, 1.0 ], [ 1.0, 2.0 ] ]
				],
				clip: []
			}));
			const occluder = clone(subject);

			const result = occlude(clone(subject), clone(occluder), Z); // occlude works in-place, so need to clone

			expect(recover).to.have.been.called;
			// The subject should now be empty, because the subject polygon returned by recover() should have been
			// discarded due to the undersize edge
			expect(result).to.be.empty;
		});

		it('should filter out very small occluder polygons after error recovery', function() {
			// Fake a zero-length error on the first call
			polybool.selectDifference
				.callThrough()
				.onFirstCall().throws(new TypeError('zero-length segment detected')); 
			// Make recover return a clip polygon that has an undersize edge
			recover.callsFake(subject => ({
				subject: [ subject ],
				clip: [
					[ [ 1.0, 1.0 ], [ 1.0 + 0.5 * MIN_LENGTH, 1.0 ], [ 1.0, 2.0 ] ]
				]
			}));
			const occluder = clone(subject);

			const result = occlude(clone(subject), clone(occluder), Z); // occlude works in-place, so need to clone

			expect(recover).to.have.been.called;
			// The subject should be unchanged, because the clip polygon returned by recover() should have been
			// discarded due to the undersize edge
			expect(result).to.deep.equal(subject);
		});

		it('should perform error recovery a maximum of MAX_RETRIES times', async function() {
			// Fake a zero-length error on every call
			polybool.selectDifference.throws(new TypeError('zero-length segment detected'))

			const occluder = clone(subject);

			const result = occlude(clone(subject), clone(occluder), Z); // occlude works in-place, so need to clone

			// There should have been MAX_RETRIES attempts at error recovery
			expect(recover).to.have.callCount(MAX_RETRIES);
			
			expect(result).to.deep.equal(subject);
		});	
	})
});