import * as DotNotation from '../../src/util/dotnotation.js';

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
	});

	describe('join', function() {
		it('should return the elements joined by dots', function() {
			expect(DotNotation.join(['a','b','c'])).to.be.a('string').that.equals('a.b.c');
		});
	});

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
		
		it('should include inherited properties', function() {
			// Dummy class to check against.
			class C { get accessorProperty() { return 2 }}
			Object.defineProperty(C.prototype, 'accessorProperty', { enumerable: true });
			C.prototype.inheritedProperty = 1;

			expect(DotNotation.resolve('inheritedProperty', new C()), 'property on the prototype')
				.to.be.an('array').with.members(['inheritedProperty']);
			expect(DotNotation.resolve('accessorProperty', new C()), 'accessor property specifically made enumerable')
				.to.be.an('array').with.members(['accessorProperty']);
		});

		it('should error on a compound key', function() {
			expect(DotNotation.resolve.bind(null, 'a.b')).to.throw();
		});
	});

	describe('matches', function() {
		it('should return true for a simple matching key and path, false for non-matching key and path', function() {
			const key = 'key';
			expect(DotNotation.matches(key, key)).to.be.true;
			expect(DotNotation.matches(key, 'path different')).to.be.false;
			expect(DotNotation.matches('key different', key)).to.be.false;
		});

		it('should return true for a matching compound key and path, false for non-matching', function() {
			const key = 'this.is.a.compound.key';
			expect(DotNotation.matches(key, key)).to.be.true;
			expect(DotNotation.matches(key, 'non.matching.compound.path')).to.be.false;
			expect(DotNotation.matches(key, 'this.is.a.key')).to.be.false;
			expect(DotNotation.matches('non.matching.compound.key', key)).to.be.false;
		});

		it('should return true for a matching complex key and path, false for non-matching', function() {
			const key = 'complex*';
			expect(DotNotation.matches(key, 'complex')).to.be.true;
			expect(DotNotation.matches(key, 'complex1')).to.be.true;
			expect(DotNotation.matches(key, 'compl')).to.be.false;
			expect(DotNotation.matches(key, 'notcomplex')).to.be.false;
		});

		it('should return true for a matching compound complex key, false for non-matching', function() {
			const key = 'this.is.the.*.compound.key';
			expect(DotNotation.matches(key, 'this.is.the.first.compound.key')).to.be.true;
			expect(DotNotation.matches(key, 'this.is.the.second.compound.key')).to.be.true;
			expect(DotNotation.matches(key, 'this.is.a.third.compound.key')).to.be.false;
			expect(DotNotation.matches(key, 'and.this.is.the.fourth.compound.key')).to.be.false;
		});
	});
});