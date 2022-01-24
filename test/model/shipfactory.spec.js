var shipFactory = require('../../src/model/shipfactory');

describe('ShipFactory', function() {
	const TEST_DATA = {
		PAAA001_Test1: {
			id: 1,
			index: 'PAAA001',
			name: 'PAAA001_Test1'
		},
		PAAA002_Test2: {
			id: 2,
			index: 'PAAA002',
			name: 'PAAA002_Test2',
			reference: 'PAAA001_Test1'
		},
		PAAA003_Test3: {
			id: 3,
			index: 'PAAA003',
			name: 'PAAA003_Test3',
			nested: {
				reference: 'PAAA001_Test1'
			}
		},
		PAAA004_Test4: {
			id: 4,
			index: 'PAAA004',
			name: 'PAAA004_Test4',
			arr: ['PAAA001_Test1']
		},
		PAAA005_Test5: {
			id: 5,
			index: 'PAAA005',
			name: 'PAAA005_Test5',
			nested: {
				arr: ['PAAA002_Test2']
			}
		}

	};

	describe('#createShip', function() {
		beforeEach(function() {
			shipFactory.setEverything(TEST_DATA);
		});

		it('should throw an error if no data has been set', function() {
			// Unset data from beforeEach
			shipFactory.setEverything(undefined);
			expect(function() { shipFactory.createShip('PAAA001'); }).to.throw(/No data/);

		});

		it('should throw an error if a malformed designator is passed', function() {
			// Need to wrap the call in a function, because a function is
			// expected as the parameter, not the function invocation's result
			
			// Check that a malformed designator causes an exception
			expect(function() { shipFactory.createShip('malformed'); }).to.throw(/Invalid argument/);

			// Check that providing no designator at all causes an exception
			expect(function() { shipFactory.createShip(); }).to.throw(/Invalid argument/);
		});

		it('should be able to retrieve a simple object by id', function() {			
			expect(shipFactory.createShip(1)).to.equal(TEST_DATA.PAAA001_Test1);
		});

		it('should be able to retrieve a simple object by reference code', function() {			
			expect(shipFactory.createShip('PAAA001')).to.equal(TEST_DATA.PAAA001_Test1);
		});

		it('should resolve references', function() {
			expect(shipFactory.createShip('PAAA002')).to.have.property('reference').that.equals(TEST_DATA.PAAA001_Test1);
		});

		it('should not resolve blacklisted references', function() {
			expect(shipFactory.constructor.IGNORED_KEYS).to.include('name'); // Just to make sure
			expect(shipFactory.createShip('PAAA001')).to
				.have.property('name')
				.that.equals(TEST_DATA.PAAA001_Test1.name);
		});

		it('should resolve references in nested objects', function() {
			expect(shipFactory.createShip('PAAA003')).to
				.have.nested.property('nested.reference')
				.that.equals(TEST_DATA.PAAA001_Test1);
		});

		it('should resolve references in arrays', function() {
			expect(shipFactory.createShip('PAAA004')).to
				.have.property('arr')
				.that.is.an('array')
				.that.includes(TEST_DATA.PAAA001_Test1);
		});

		it('should fully resolve complex objects', function() {
			expect(shipFactory.createShip('PAAA005')).to
				.have.nested.property('nested.arr[0].reference')
				.that.equals(TEST_DATA.PAAA001_Test1);
		})
	});
});