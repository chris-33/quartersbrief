import executeSteps, { each, passthrough } from '../../../src/update/infra/execute-steps.js';
import sinon from 'sinon';

describe('executeSteps', function() {
	it('should call each step in turn with the results of the previous step', async function() {
		return Promise.all([ 'synchronous', 'asynchronous' ].map(async mode => {

			const returnMethod = { synchronous: 'returns', asynchronous: 'resolves' }[mode];
			const steps = [ 0, 1, 2 ].map(i => sinon.stub()[returnMethod](i));
			const expected = [ undefined, 0, 1, 2 ];

			let result = await executeSteps(steps);
			
			steps.forEach((step, index) => expect(step, `${index} ${mode}`).to.have.been.calledWith(expected[index]));
			expect(result, `result ${mode}`).to.equal(expected.at(-1));

		}));
	});
});

describe('each', function() {
	it('should call the step function with each array item instead of the array', async function() {
		const step = sinon.stub();
		const arg = [ 1, 2, 3 ];
		await each(step)(arg);

		arg.forEach(arg => expect(step).to.have.been.calledWith(arg));
	});

	it('should call the step function with each object property instead of the object', async function() {
		const step = sinon.stub();
		const arg = { a: 'a', b: 'b' };
		await each(step)(arg);
		
		for (let key in arg) 
			expect(step).to.have.been.calledWith(arg[key]);
	});

	// eslint-disable-next-line mocha/no-setup-in-describe
	[
		[ 1, 2 ],
		{ a: 'a', b: 'b' }
	].forEach(arg => it(`should run sequentially instead of concurrently on ${Array.isArray(arg) ? 'arrays' : 'objects'}`, async function() {
		const step = sinon.stub();
		let resolve;
		// A promise that will eventually be resolved with whether or not the second call
		// was waiting when the first executed (true), or had already initiated (false)
		let waitedForFirst = new Promise(_resolve => resolve = _resolve);
		step.onFirstCall().callsFake(function() {
			// Defer so the second has a chance to get started
			// (Otherwise this would always be true, even if step is run concurrently)
			setImmediate(() => resolve(step.callCount === 1));
			return waitedForFirst;
		});
		step.onSecondCall().resolves();

		await each(step)(arg);
		expect(await waitedForFirst).to.be.true;
	}));
});

describe('passthrough', function() {
	it('should call the step function with the argument and return the argument', async function() {
		const arg = {};
		const step = sinon.stub();

		let result = await passthrough(step)(arg);

		expect(step).to.have.been.calledWith(arg);
		expect(result).to.equal(arg);
	});
});