import { interconnect } from '../../src/armor/recover.js';

describe.only('occlude zero-length recovery', function() {
	describe('interconnect', function() {
		let subject;
		beforeEach(function() {
			subject = [
				{ vertex: [ 1, 1 ] },
				{ vertex: [ 3, 1 ] },
				{ vertex: [ 3, 3 ] },
				{ vertex: [ 1, 3 ] }
			];
		});

		it('should insert intersections into both polygons', function() {			
			// +----------+
			// |          |
			// |    +-----+-----+
			// |    |     |     |
			// +----+-----+     |
			//      |           |
			//      +-----------+
			const clip = [
				{ vertex: [ 2, 0 ] },
				{ vertex: [ 4, 0 ] },
				{ vertex: [ 4, 2 ] },
				{ vertex: [ 2, 2 ] }
			];

			const result = interconnect(subject, clip);
		
			expect(result).to.be.an('object').with.keys(['subject','clip']);

			expect(result.subject).to.be.an('array').with.lengthOf(6);
			expect(result.subject.map(item => item.vertex)).to.have.ordered.deep.members([
				[ 1, 1 ], // bottom left
				[ 2, 1 ], // intersection
				[ 3, 1 ], // bottom right
				[ 3, 2 ], // intersection
				[ 3, 3 ], // top right
				[ 1, 3 ], // top left
			]);
			expect(result.subject[1]).to.have.property('intersection', true);
			expect(result.subject[1]).to.have.property('corresponding', result.clip[5]);
			expect(result.subject[3]).to.have.property('intersection', true);
			expect(result.subject[3]).to.have.property('corresponding', result.clip[3]);

			expect(result.clip).to.be.an('array').with.lengthOf(6);
			expect(result.clip.map(item => item.vertex)).to.have.ordered.deep.members([
				[ 2, 0 ], // bottom left
				[ 4, 0 ], // bottom right
				[ 4, 2 ], // top right
				[ 3, 2 ], // intersection
				[ 2, 2 ], // top left
				[ 2, 1 ], // intersection
			]);
			expect(result.clip[3]).to.have.property('intersection', true);
			expect(result.clip[3]).to.have.property('corresponding', result.subject[3]);
			expect(result.clip[5]).to.have.property('intersection', true);
			expect(result.clip[5]).to.have.property('corresponding', result.subject[1]);
		});

		it('should insert both endpoints of completely shared common segments into the containing polygon', function() {
			// +----------+
			// |          |
			// |          |
			// |          |
			// +---+==+---+
			//     |  |
			//     +--+
			const clip = [
				{ vertex: [ 1.5, 0 ] },
				{ vertex: [ 2.5, 0 ] },
				{ vertex: [ 2.5, 1 ] },
				{ vertex: [ 1.5, 1 ] }
			];

			const result = interconnect(subject, clip);

			expect(result).to.be.an('object').with.keys(['subject','clip']);

			expect(result.subject).to.be.an('array').with.lengthOf(6);
			expect(result.subject.map(item => item.vertex)).to.have.ordered.deep.members([
				[ 1, 1 ],   // bottom left
				[ 1.5, 1 ], // intersection
				[ 2.5, 1 ], // intersection
				[ 3, 1 ],   // bottom right
				[ 3, 3 ],   // top right
				[ 1, 3 ]    // top left
			]);
			expect(result.subject[1]).to.have.property('intersection', true);
			expect(result.subject[1]).to.have.property('corresponding', result.clip[3]);
			expect(result.subject[2]).to.have.property('intersection', true);
			expect(result.subject[2]).to.have.property('corresponding', result.clip[2]);

			expect(result.clip).to.be.an('array').with.lengthOf(4);
			expect(result.clip.map(item => item.vertex)).to.have.ordered.deep.members([
				[ 1.5, 0 ], // bottom left
				[ 2.5, 0 ], // bottom right
				[ 2.5, 1 ], // top right, intersection
				[ 1.5, 1 ]  // top left, intersection
			]);
			expect(result.clip[2]).to.have.property('intersection', true);
			expect(result.clip[2]).to.have.property('corresponding', result.subject[2]);
			expect(result.clip[3]).to.have.property('intersection', true);
			expect(result.clip[3]).to.have.property('corresponding', result.subject[1]);
		});

		it('should insert the endpoints of partially shared common segments into both polygons', function() {
			// +----------+
			// |          |
			// |          |
			// |          |
			// +---+======+------+
			//     |             |
			//     +-------------+
			let clip = [
				{ vertex: [ 2, 0 ] },
				{ vertex: [ 4, 0 ] },
				{ vertex: [ 4, 1 ] },
				{ vertex: [ 2, 1 ] }
			];

			let result = interconnect(subject, clip);

			expect(result).to.be.an('object').with.keys(['subject','clip']);

			expect(result.subject).to.be.an('array').with.lengthOf(5);
			expect(result.subject.map(item => item.vertex)).to.have.ordered.deep.members([
				[ 1, 1 ], // bottom left
				[ 2, 1 ], // intersection
				[ 3, 1 ], // bottom right, intersection
				[ 3, 3 ], // top right
				[ 1, 3 ]  // top left
			]);
			expect(result.subject[1]).to.have.property('intersection', true);
			expect(result.subject[1]).to.have.property('corresponding', result.clip[4]);
			expect(result.subject[2]).to.have.property('intersection', true);
			expect(result.subject[2]).to.have.property('corresponding', result.clip[3]);

			expect(result.clip).to.be.an('array').with.lengthOf(5);
			expect(result.clip.map(item => item.vertex)).to.have.ordered.deep.members([
				[ 2, 0 ], // bottom left
				[ 4, 0 ], // bottom right
				[ 4, 1 ], // top right
				[ 3, 1 ], // intersection
				[ 2, 1 ]  // top left, intersection
			]);
			expect(result.clip[3]).to.have.property('intersection', true);
			expect(result.clip[3]).to.have.property('corresponding', result.subject[2]);
			expect(result.clip[4]).to.have.property('intersection', true);
			expect(result.clip[4]).to.have.property('corresponding', result.subject[1]);

			//     +----------+
			//     |          |
			//     |          |
			//     |          |
			// +---+======+---+
			// |          |
			// +----------+
			// This is different from the previous scenario in that in this case, the start points of 
			// the segments are mutually included in the other polygon's segment.
			clip = [
				{ vertex: [ 0, 0 ] },
				{ vertex: [ 2, 0 ] },
				{ vertex: [ 2, 1 ] },
				{ vertex: [ 0, 1 ] }
			];
debugger
			result = interconnect(subject, clip);

			expect(result).to.be.an('object').with.keys(['subject','clip']);

			expect(result.subject).to.be.an('array').with.lengthOf(5);
			expect(result.subject.map(item => item.vertex)).to.have.ordered.deep.members([
				[ 1, 1 ], // bottom left, intersection
				[ 2, 1 ], // intersection
				[ 3, 1 ], // bottom right
				[ 3, 3 ], // top right
				[ 1, 3 ]  // top left
			]);
			expect(result.subject[0]).to.have.property('intersection', true);
			expect(result.subject[0]).to.have.property('corresponding', result.clip[3]);
			expect(result.subject[1]).to.have.property('intersection', true);
			expect(result.subject[1]).to.have.property('corresponding', result.clip[2]);

			expect(result.clip).to.be.an('array').with.lengthOf(5);
			expect(result.clip.map(item => item.vertex)).to.have.ordered.deep.members([
				[ 0, 0 ], // bottom left
				[ 2, 0 ], // bottom right
				[ 2, 1 ], // top right, intersection
				[ 1, 1 ], // intersection
				[ 0, 1 ]  // top left
			]);
			expect(result.clip[2]).to.have.property('intersection', true);
			expect(result.clip[2]).to.have.property('corresponding', result.subject[1]);
			expect(result.clip[3]).to.have.property('intersection', true);
			expect(result.clip[3]).to.have.property('corresponding', result.subject[0]);
		});

		it('should mark a vertex on an edge as an intersection and insert it into the edge', function() {
			// +----------+ +
			// |          |/ \
			// |          +   +
			// |          |\ /
			// +----------+ +
			const clip = [
				{ vertex: [ 4, 1 ] },
				{ vertex: [ 5, 2 ] },
				{ vertex: [ 4, 3 ] },
				{ vertex: [ 3, 2 ] }
			];
			const result = interconnect(subject, clip);

			expect(result).to.be.an('object').with.keys(['subject','clip']);

			expect(result.subject).to.be.an('array').with.lengthOf(5);
			expect(result.subject.map(item => item.vertex)).to.have.ordered.deep.members([
				[ 1, 1 ], // bottom left
				[ 3, 1 ], // bottom right
				[ 3, 2 ], // intersection
				[ 3, 3 ], // top right
				[ 1, 3 ]  // top left
			]);
			expect(result.subject[2]).to.have.property('intersection', true);
			expect(result.subject[2]).to.have.property('corresponding', result.clip[3]);

			expect(result.clip).to.be.an('array').with.lengthOf(4);
			expect(result.clip.map(item => item.vertex)).to.have.ordered.deep.members([
				[ 4, 1 ], // bottom
				[ 5, 2 ], // right
				[ 4, 3 ], // top
				[ 3, 2 ], // left, intersection
			]);
			expect(result.clip[3]).to.have.property('intersection', true);
			expect(result.clip[3]).to.have.property('corresponding', result.subject[2]);
		});

		it('should mark a shared vertex as an intersection in both polygons', function() {
			// +----------+
			// |          |
			// |          |
			// |          |
			// +----------+-------+
			//            |       |
			//            +-------+
			const clip = [
				{ vertex: [ 3, 0 ] },
				{ vertex: [ 5, 0 ] },
				{ vertex: [ 5, 1 ] },
				{ vertex: [ 3, 1 ] }
			];
			const result = interconnect(subject, clip);

			expect(result).to.be.an('object').with.keys(['subject','clip']);

			expect(result.subject).to.be.an('array').with.lengthOf(4);
			expect(result.subject.map(item => item.vertex)).to.have.ordered.deep.members([
				[ 1, 1 ], // bottom left
				[ 3, 1 ], // bottom right, intersection
				[ 3, 3 ], // top right
				[ 1, 3 ]  // top left
			]);
			expect(result.subject[1]).to.have.property('intersection', true);
			expect(result.subject[1]).to.have.property('corresponding', result.clip[3]);

			expect(result.clip).to.be.an('array').with.lengthOf(4);
			expect(result.clip.map(item => item.vertex)).to.have.ordered.deep.members([
				[ 3, 0 ], // bottom left
				[ 5, 0 ], // bottom right
				[ 5, 1 ], // top right
				[ 3, 1 ]  // top left, intersection
			]);
			expect(result.clip[3]).to.have.property('intersection', true);
			expect(result.clip[3]).to.have.property('corresponding', result.subject[1]);
		});
	});
});