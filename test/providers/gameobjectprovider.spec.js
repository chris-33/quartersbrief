import GameObject from '../../src/model/gameobject.js';
import sinon from 'sinon';
import esmock from 'esmock';

describe('GameObjectProvider', function() {
	let GameObjectProvider;

	let obj;

	let gameObjectProvider;

	before(async function() {
		class MockSupplier {
			get = sinon.stub().resolves(obj);
		}
		GameObjectProvider = (await esmock('../../src/providers/gameobjectprovider.js', {
			'../../src/providers/gameobjectsupplier.js': MockSupplier
		})).default;
	});

	beforeEach(function() {
		obj = new GameObject({
			id: 1,
			index: 'PAAA001',
			name: 'PAAA001_Test1',
			typeinfo: {
				type: 'Type1'
			}
		});
	});

	beforeEach(function() {
		gameObjectProvider = new GameObjectProvider();
	});

	describe('.createGameObject', function() {
		it('should throw an error if a malformed designator is passed', async function() {
			// Check that a malformed designator causes an exception
			await expect(gameObjectProvider.createGameObject('malformed')).to.be.rejectedWith(/Invalid argument/);

			// Check that providing no designator at all causes an exception
			await expect(gameObjectProvider.createGameObject(gameObjectProvider)).to.be.rejectedWith(/Invalid argument/);
		});

		it('should get the requested object from its supplier', async function() {
			await gameObjectProvider.createGameObject('PAAA001_Test1');

			expect(gameObjectProvider.supplier.get).to.have.been.calledWith('PAAA001_Test1');
		});

		it('should always return a fresh instance', async function() {
			const gameObject1 = await gameObjectProvider.createGameObject('PAAA001_Test1');
			const gameObject2 = await gameObjectProvider.createGameObject('PAAA001_Test1');
				
			expect(gameObject1).to.not.equal(gameObject2);
			expect(gameObject1).to.deep.equal(gameObject2);
		});

		it('should clone contained game objects, keeping their class', async function() {
			class Reference extends GameObject {}
			const REFERENCE_DATA = {
				prop: 'testproperty'
			}
			obj._data.reference = new Reference(REFERENCE_DATA);

			const gameObject = await gameObjectProvider.createGameObject('PAAA001_Test1');
			expect(gameObject._data).to
				.have.property('reference')
				.that.is.an.instanceOf(Reference);
			expect(gameObject._data.reference._data)
				.and.deep.equals(REFERENCE_DATA);
		});
	});
});