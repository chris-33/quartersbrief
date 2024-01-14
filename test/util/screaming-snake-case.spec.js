import screamingSnakeCase from '../../src/util/screaming-snake-case.js';

describe('screamingSnakeCase', function() {
	it('should turn a single word into upper case', function() {
		expect(screamingSnakeCase('word')).to.equal('WORD');
	});

	it('should be in all capitals with underscores inserted between word boundaries', function() {
		expect(screamingSnakeCase('severalWords')).to.equal('SEVERAL_WORDS');
	});

	it('should work with upper camel case (PascalCase)', function() {
		expect(screamingSnakeCase('SeveralWords')).to.equal('SEVERAL_WORDS');		
	});
});