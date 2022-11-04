import { executeSteps, each } from '../../src/update/update.js';
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

	it('should handle errors in some mysterious and yet unspecified way');
});

describe('each', function() {
	it('should call the step function with each array item instead of the array', async function() {
		const step = sinon.stub();
		const arg = [ 1, 2, 3 ];
		await executeSteps([
			() => arg,
			each(step)
		]);
		arg.forEach(arg => expect(step).to.have.been.calledWith(arg));
	});
});