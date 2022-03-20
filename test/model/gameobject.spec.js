import { GameObject } from '../../src/model/gameobject.js';
import clone from 'clone';
import sinon from 'sinon';

describe('GameObject', function() {
	const TEST_DATA = { 
		prop1: 'string', 
		prop2: 0,
		nested: { prop3: 'prop3' },
		arr: [ 'prop4' ],
		go: {
			prop: 'gameobject',
			typeinfo: {
				type: "Type1",
				species: null,
				nation: "Common"
			}
		},
		inner: {
			go: {
				prop: 'gameobject',
				typeinfo: {
					type: "Type1",
					species: null,
					nation: "Common"
				}
			}
		},
		typeinfo: {
			type: "Type1",
			species: null,
			nation: "Common"
		}
	};
	let gameObject;

	beforeEach(function() {
		gameObject = new GameObject(clone(TEST_DATA));
	});

	it('should copy all properties from the source', function() {
		expect(gameObject).to
			.have.property('_data')
			.that.deep.equals(TEST_DATA);
	});

	describe('.freshCopy', function() {
		beforeEach(function() {
			const data = clone(TEST_DATA);
			data.inner.go = new GameObject(data.inner.go);
			data.go = new GameObject(data.go);
			
			gameObject = new GameObject(data);
		});

		it('should make a deep copy of the source', function() {
			const other = gameObject.freshCopy();
			expect(gameObject).to.not.equal(other);
			expect(gameObject).to.deep.equal(other);			
		});

		it('should not invoke getters', function() {
			const spy = sinon.spy();
			// Invoking getters would force lazily expanded references to expand
			Object.defineProperty(gameObject._data, 'reference', {
				get: spy,
				enumerable: true,
				configurable: true
			});
			gameObject.freshCopy();
			expect(spy).to.not.have.been.called;
		});

		it('should make copies of nested properties that are not game objects', function() {
			const data = gameObject._data;
			const other = gameObject.freshCopy();
			for (let key in data)
				if (typeof data[key] === 'object' && data[key] !== null && !(data[key] instanceof GameObject)) {
					expect(data[key]).to.not.equal(other._data[key]);
					expect(data[key]).to.deep.equal(other._data[key]);
				}
		});

		it('should contain fresh copies of all nested game objects', function() {
			const other = gameObject.freshCopy();
			expect(gameObject._data.go).to.exist.and.be.an.instanceof(GameObject);
			expect(gameObject._data.go).to.not.equal(other._data.go);
			expect(gameObject._data.go).to.deep.equal(other._data.go);

			expect(gameObject._data.inner.go).to.exist.and.be.an.instanceof(GameObject);
			expect(gameObject._data.inner.go).to.not.equal(other._data.inner.go);
			expect(gameObject._data.inner.go).to.deep.equal(other._data.inner.go);
		});
	});
});