import { GameObject } from '../../src/model/gameobject.js';
import DotNotation from '../../src/util/dot-notation.js';
import clone from 'clone';

describe.only('DotNotation', function() {
	const TEST_DATA = {
			prop1: 1,
			prop2: 0,
			prop3: 1,
			nested: { prop1: 1, prop2: 0, prop3: 1 },
			nested2: { prop1: 1, prop2: 1 },
			arr: [ 1, 1 ]
	};
	let dotnotation;
	beforeEach(function() {
		dotnotation = new DotNotation(clone(TEST_DATA));
	});

	describe('resolveStep', function() {
		it('should return an array with only the matching property on a simple key', function() {
			for (let key in TEST_DATA)
				expect(dotnotation.resolveStep(key)).to
					.be.an('array')
					.with.deep.members([ TEST_DATA[key] ]);
		});

		it('should return an array of all matching properties on a wildcard key', function() {
			const expected = [ TEST_DATA.prop1, TEST_DATA.prop2, TEST_DATA.prop3 ];
			expect(dotnotation.resolveStep('prop*')).to
				.be.an('array')
				.with.deep.members(expected);
		});

		it('should work off the specified base when given', function() {
			for (let key in TEST_DATA.nested)
				expect(dotnotation.resolveStep(key, TEST_DATA.nested), `simple key ${key}`).to
					.be.an('array')
					.with.deep.members([ TEST_DATA.nested[key] ]);

			expect(dotnotation.resolveStep('prop*', TEST_DATA.nested), 'complex key').to
				.be.an('array')
				.with.deep.members([ TEST_DATA.nested.prop1, TEST_DATA.nested.prop2, TEST_DATA.nested.prop3 ]);
		});

		it('should handle GameObjects transparently', function() {
			dotnotation = new DotNotation(new GameObject(clone(TEST_DATA)));
			for (let key in TEST_DATA)
				expect(dotnotation.resolveStep(key)).to
					.be.an('array')
					.with.deep.members([ TEST_DATA[key] ]);
		});
	});

	describe('applyFn', function() {
		const fn = x => x++;
		let data;

		beforeEach(function() {
			data = clone(TEST_DATA);
			dotnotation = new DotNotation(data);
		});

		it('should apply the function to the data on a simple key', function() {
			dotnotation.applyFn('prop2', fn);
			expect(data.prop2).to.equal(fn(TEST_DATA.prop2));
		});

		it('should apply the function to the data on a complex key', function() {
			const fn = () => null;
			dotnotation.applyFn('*', fn);
			for (let key in TEST_DATA)
				expect(data[key]).to.be.null;
		});

		it('should return an array of all function results', function() {
			expect(dotnotation.applyFn('prop2', fn)).to
				.be.an('array')
				.with.members([ fn(TEST_DATA.prop2) ]);
			expect(dotnotation.applyFn('*', () => null)).to
				.be.an('array')
				.with.lengthOf(Object.keys(TEST_DATA).length)
				.that.satisfies(arr => arr.every(item => item === null));
		});

		it('should work off the specified base when given', function() {
			dotnotation.applyFn('*', fn, data.nested);
			for (let key in TEST_DATA.nested)
				expect(data.nested[key]).to
					.equal(fn(TEST_DATA.nested[key]));
		});

		it('should handle GameObjects transparently', function() {
			dotnotation.applyFn('prop2', fn);
			for (let key in TEST_DATA)
				expect(dotnotation.resolveStep(key)).to
					.be.an('array')
					.with.deep.members([ TEST_DATA[key] ]);
		});
	});

	describe('resolveToParents', function() {
		it('should return an array with only the data object if the key contains no dots', function() {
			for (let key in TEST_DATA)
				expect(dotnotation.resolveToParents(key), key).to
					.be.an('array')
					.with.deep.members([ TEST_DATA ]);
		});

		it('should return an array of the object directly containing the specified key property on a simple key', function() {
			for (let key in TEST_DATA.nested)
				expect(dotnotation.resolveToParents(`nested.${key}`)).to
					.be.an('array')
					.with.deep.members([ TEST_DATA.nested ]);
		});

		it('should return an array of all parent objects on a key with wildcards', function() {
			expect(dotnotation.resolveToParents('nested*.prop1')).to
				.be.an('array')
				.with.deep.members([ TEST_DATA.nested, TEST_DATA.nested2 ]);

			expect(dotnotation.resolveToParents('nested.prop*')).to
				.be.an('array')
				.with.deep.members([ TEST_DATA.nested ]);
		});
	});

	describe('DotNotation.Key', function() {
		describe('path', function() {
			it('should return everything up to the last dot', function() {
				expect(new DotNotation.Key('nested.prop1').path).to.equal('nested');
				expect(new DotNotation.Key('nested.innernested.prop').path).to.equal('nested.innernested');
				expect(new DotNotation.Key('nodot').path).to.equal('');
			});		
		});

		describe('prop', function() {
			it('should return everything after to the last dot', function() {
				expect(new DotNotation.Key('nested.prop1').prop).to.equal('prop1');
				expect(new DotNotation.Key('nested.innernested.prop').prop).to.equal('prop');
				expect(new DotNotation.Key('nodot').prop).to.equal('nodot');
			});		
		});

		describe('isComplex', function() {
			it('should be true if and only if the key contains a wildcard', function() {				
				expect(new DotNotation.Key('with.dot').isComplex()).to.be.false;
				expect(new DotNotation.Key('nodot').isComplex()).to.be.false;
				expect(new DotNotation.Key('with.*').isComplex()).to.be.true;
				expect(new DotNotation.Key('*').isComplex()).to.be.true;
			});
		});
	});
});