'use strict';

// eslint-disable-next-line no-unused-vars
function highlight(el) {
	let ships = el.dataset.for.split(' ');
	el
		.closest('.topic')
		.querySelectorAll(ships.map(ship => `[data-for~="${ship}"]`).join(','))
		.forEach(node => node.classList.toggle('highlighted'));
}