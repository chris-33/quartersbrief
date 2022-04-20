import DotNotation from '../../src/util/dotnotation.js';

describe('DotNotation', function() {
	describe('isComplex', function() {
		it('should be true if key contains wildcards, false otherwise', function() {
			expect(DotNotation.isComplex('*')).to.be.true;
			expect(DotNotation.isComplex('')).to.be.false;
			expect(DotNotation.isComplex('a*')).to.be.true;
			expect(DotNotation.isComplex('a.*')).to.be.true;
			expect(DotNotation.isComplex('*.a')).to.be.true;
		});
	});

	describe('isCompound', function() {
		it('should be true if key contains a dot, false otherwise', function() {
			expect(DotNotation.isCompound('a.b')).to.be.true;
			expect(DotNotation.isCompound('a')).to.be.false;
			expect(DotNotation.isCompound('')).to.be.false;
			expect(DotNotation.isCompound('a.*')).to.be.true;
			expect(DotNotation.isCompound('*')).to.be.false;
		});
	});
	
	describe('elements', function() {
		it('should return the individual elements which are separated by dots', function() {
			expect(DotNotation.elements('a.b.c')).to.be.an('array').with.members([ 'a', 'b', 'c' ]);
		});
	})

	describe('resolve', function() {
		it('should return an array containing only the requested property on a simple key', function() {
			expect(DotNotation.resolve('a', { a: 1 })).to.be.an('array').with.members(['a']);
		});

		it('should return an empty array if the object doesn\'t contain any matching properties', function() {
			expect(DotNotation.resolve('a', {})).to.be.an('array').that.is.empty;
		});

		it('should return an array of all matches on a complex key', function() {
			expect(DotNotation.resolve('*', { a: 1, b: 2 })).to.be.an('array').with.members([ 'a', 'b' ]);
			expect(DotNotation.resolve('a*', { a1: 1, a2: 2, b: 3 })).to.be.an('array').with.members([ 'a1', 'a2' ]);
		});
		
		it('should error on a compound key', function() {
			expect(DotNotation.resolve.bind(null, 'a.b')).to.throw();
		});
	});
});