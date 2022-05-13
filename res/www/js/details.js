$('[data-details]').each(function(index, element) {
	element = $(element);
	// Scope search to topic
	const scope = element.closest('.topic');
	const details = $(`aside[data-details-for="${element.attr('data-details')}"]`, scope);

	if (details.length === 0) return;
	if (details.length > 1) throw new Error(`Expected to find at most one details element for ${element.attr('data-details')} but found ${details.length}`);

	const popper = Popper.createPopper(element.get(0), details.get(0), {
		placement: 'right',
		modifiers: [
				{ name: 'flip', options: {} },
				{ name: 'offset', options: { offset: [ 0, 5 ]}}
			]
	});

	element.on('mouseenter focus', function() {
		details.attr('data-show', true);

		// Enable the event listeners; see https://popper.js.org/docs/v2/tutorial/#performance
		popper.setOptions((options) => ({
			...options,
			modifiers: [
				...options.modifiers,
				{ name: 'eventListeners', enabled: true },
			],
		}));

		popper.update();
	});

	element.on('mouseleave blur', function hide() {
		details.removeAttr('data-show');

		// Disable the event listeners; see https://popper.js.org/docs/v2/tutorial/#performance
		popper.setOptions((options) => ({
			...options,
			modifiers: [
				...options.modifiers,
				{ name: 'eventListeners', enabled: false },
			],
		}));			
	});
});