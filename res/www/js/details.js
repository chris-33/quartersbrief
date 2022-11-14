import { createPopper } from 'https://cdnjs.cloudflare.com/ajax/libs/popper.js/2.11.6/esm/popper.min.js';

export default function makeDetails(topic) {
	topic.querySelectorAll('[data-details]').forEach(element => {
		let details = topic.querySelectorAll(`aside[data-details-for="${element.dataset.details}"]`);

		if (details.length === 0) return;
		if (details.length > 1) throw new Error(`Expected to find at most one details element for ${element.dataset.details} but found ${details.length}`);
		details = details[0];

		const popper = createPopper(element, details, {
			placement: 'right',
			modifiers: [
				{ name: 'flip', options: {} },
				{ name: 'offset', options: { offset: [ 0, 5 ]}}
			]
		});

		['mouseenter', 'focus'].forEach(eventName => element.addEventListener(eventName, function show() {
			details.dataset.show = true;

			// Enable the event listeners; see https://popper.js.org/docs/v2/tutorial/#performance
			popper.setOptions((options) => ({
				...options,
				modifiers: [
					...options.modifiers,
					{ name: 'eventListeners', enabled: true },
				],
			}));

			popper.update();
		}));

		['mouseleave','blur'].forEach(eventName => element.addEventListener(eventName, function hide() {
			delete details.dataset.show;

			// Disable the event listeners; see https://popper.js.org/docs/v2/tutorial/#performance
			popper.setOptions((options) => ({
				...options,
				modifiers: [
					...options.modifiers,
					{ name: 'eventListeners', enabled: false },
				],
			}));			
		}));	
	});
	return topic;
}