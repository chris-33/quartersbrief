import * as clauses from '../../src/agendas/clauses.js';
import DataObject from '../../src/model/dataobject.js';

describe('clauses', function() {
	before(function() {
		Object.defineProperty(DataObject.prototype, 'prop', {
			get: function() { return this._data.prop },
			set: function(prop) { this._data.prop = prop },
			enumerable: true,
			configurable: true
		});
	});
	after(function() {
		delete DataObject.prototype.prop;
	});

	describe('has-clause', function() {
		it('should run the correct comparison on expressions containing a comparator and a value', function() {
			const OPERATORS = [ '<', '<=', '==', '>=', '>' ];
			const value = 5;
			OPERATORS.forEach(op => {
				const data = new DataObject({
					prop: value
				});
				for (let i = -1; i <= 1; i++) {
					const expr = `prop ${op} ${value + i}`;
					const expected = eval(`${value} ${op} ${value + i}`);
					expect(clauses.has(data, [ expr ]), expr).to.equal(expected);					
				}
			});
		});

		it('should check for existence on an expression not containing a comparator and value', function() {
			const data = new DataObject({
				prop: 'abc'
			});
			expect(clauses.has(data, ['prop'])).to.be.true;
			expect(clauses.has(data, ['nonexistent'])).to.be.false;
		});
		
		it('should treat a string value as if it was an array containing only that string', function() {
			const data = new DataObject({
				prop: 5
			});
			expect(clauses.has(data, 'prop == 5')).to.be.true;
		});
		
		it('should throw on a malformed expression', function() {
			const malformed = [
				'.malformed_property', 'malformed_property.', 
				'missing comparator',
				'property | illegal comparator',
				'dangling_operator <='
			]
			malformed.forEach(expr => expect(clauses.has.bind(null, {}, [ expr ]), expr).to.throw())			
		});

		it('should conjoin a has-clause with more than one expression', function() {
			const data = new DataObject({
				prop1: 'abc',
				prop2: 5
			});
			[ 'prop1', 'prop2' ].forEach(prop => Object.defineProperty(data, prop, {
				get: function() { return this._data[prop] },
				set: function(prop) { this._data[prop] = prop },
				enumerable: true,
				configurable: true
			}));

			expect(clauses.has(data, [
				'prop1 == abc',
				'prop2 < 6'
			])).to.be.true;
			expect(clauses.has(data, [
				'prop1 == abc',
				'prop2 < 5'
			])).to.be.false;
		});
	});
});