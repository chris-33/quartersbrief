import Procurer from '../../src/providers/procurer.js';
import sinon from 'sinon';

describe('Procurer', function() {
	describe('constructor', function() {
		it('should be callable with an options object or just a recover function', function() {
			const recover = function() {}
			const validate = function() {}

			let procurer = new Procurer({ recover, validate });
			expect(procurer.recover).to.equal(recover);
			expect(procurer.validate).to.equal(validate);

			procurer = new Procurer(recover);
			expect(procurer.recover).to.equal(recover);
			expect(procurer.validate).to.not.exist;
		});

		it('should keep recover/validate if already defined (e.g. from subclassing) and no new functions are passed', function() {
			function recover() {}
			function validate() {}
			
			class ProcurerSubclass extends Procurer {
				recover = recover;
				validate = validate;
			}

			let procurer = new ProcurerSubclass();

			expect(procurer.recover).to.equal(recover);
			expect(procurer.validate).to.equal(validate);
		});

		it('should set recover/validate to the passed values even if already defined (e.g. from subclassing)', function() {
			function recover() {}
			function validate() {}
			
			class ProcurerSubclass extends Procurer {
				recover() {}
				validate() {}
			}

			let procurer = new ProcurerSubclass({ recover, validate });

			expect(procurer.recover).to.equal(recover);
			expect(procurer.validate).to.equal(validate);
		});
	});

	describe('get', function() {
		it('should return the requested item if it is in cache and there is no validation', async function() {
			const recover = sinon.spy();
			const procurer = new Procurer(recover);
			const designator = 'designator';
			const item = {};
	
			procurer.cache.set(designator, item);
	
			expect(recover).to.not.have.been.called;
			return expect(procurer.get(designator)).to.eventually.equal(item);
		});

		it('should validate a cached item if validation is enabled', async function() {
			const recover = sinon.spy();
			const validate = sinon.stub().returns(true);
			const procurer = new Procurer({ recover, validate });

			const designator = 'designator';
			const item = {};
	
			procurer.cache.set(designator, item);
			await procurer.get(designator);
			
			expect(validate).to.have.been.calledOn(procurer);
			expect(validate).to.have.been.calledWith(item);
		});

		it('should return the requested item if it is in cache and valid', async function() {
			const recover = sinon.spy();
			const validate = sinon.stub().returns(true);
			const procurer = new Procurer({ recover, validate });

			const designator = 'designator';
			const item = {};
	
			procurer.cache.set(designator, item);
			
			expect(recover).to.not.have.been.called;
			return expect(procurer.get(designator)).to.eventually.equal(item);
		});

		it('should call the recovery function when the requested item is not in cache', async function() {
			const recover = sinon.spy();
			const procurer = new Procurer(recover);

			const designator = 'designator';

			await procurer.get(designator);

			expect(recover).to.have.been.calledOn(procurer);
			expect(recover).to.have.been.calledWith(designator);
		});

		it('should call the recovery function when the requested item is in cache but not valid', async function() {
			const recover = sinon.spy();
			const validate = sinon.stub().returns(false);
			const procurer = new Procurer({ recover, validate });

			const designator = 'designator';
			const item = {};
			procurer.cache.set(designator, item);
			
			await procurer.get(designator);

			expect(recover).to.have.been.calledOn(procurer);
			expect(recover).to.have.been.calledWith(designator);
		});

		it('should put the item returned by the recovery function into the cache', async function() {
			const item = {};
			const designator = 'designator';

			const recover = sinon.stub().returns(item);
			const procurer = new Procurer(recover);

			await procurer.get(designator);

			expect(procurer.cache.get(designator)).to.equal(item);
		});

		it('should only run recover once even if the same designator is requested again while recovery is still running', async function() {
			// This test simulates a second call coming in to procurer.get() before recovery of the first (failed)
			// get() is completed, i.e.
			// 		first call - there is no cached item and recovery is initiated
			// 		second call
			// 		recovery completes
			// 
			// This test verifies that the second call does not do recovery again, but rather piggybacks onto the
			// result recovered by the first call.

			const item = {};
			const designator = 'designator';
			
			const recover = sinon.stub().resolves(item);
			const procurer = new Procurer(recover);

			// First call
			const first = procurer.get(designator);

			expect(procurer.cache.has(designator)).to.be.true;

			// Second call placed immediately
			const second = procurer.get(designator);
			await Promise.all([ first, second ]);

			// If everything worked correctly, there should only be one call to viewer.view()
			expect(procurer.recover).to.have.been.calledOnce;
			// Both calls should correctly resolve to expected
			return expect(first).to.eventually.equal(await second).and.equal(item);
		});
	});
});