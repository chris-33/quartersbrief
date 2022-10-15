'use strict';

function highlight(el) {
	el = $(el);
	let ships = el.data('for').split(' ');
	el
		.closest('.topic')
		.find(ships.map(ship => `[data-for~="${ship}"]`).join(','))
		.toggleClass('highlighted');
}