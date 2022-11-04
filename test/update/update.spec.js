import { update } from '../../src/update/update.js';
import sinon from 'sinon';

describe('update', function() {
	it('should call each step in turn with the results of the previous step', async function() {
		return Promise.all([ 'synchronous', 'asynchronous' ].map(async mode => {

			const returnMethod = { synchronous: 'returns', asynchronous: 'resolves' }[mode];
			const steps = [ 0, 1, 2 ].map(i => sinon.stub()[returnMethod](i));
			const expected = [ undefined, 0, 1, 2 ];

			let result = await update(steps);
			
			steps.forEach((step, index) => expect(step, `${index} ${mode}`).to.have.been.calledWith(expected[index]));
			expect(result, `result ${mode}`).to.equal(expected.at(-1));

		}));
	});
});