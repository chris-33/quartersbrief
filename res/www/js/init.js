import { io } from 'https://cdn.socket.io/4.4.1/socket.io.esm.min.js'
import * as handlers from './io.js';

window.addEventListener('DOMContentLoaded', function() {
	// Delay socket connection to when the DOM is safe to manipulate
	// Otherwise, we can have issues where fast-building topics are
	// delivered before the DOM is ready to receive them
	// This results in them getting "lost" and never being displayed.
	const socket = io();

	// Auto-register all event handlers, based on the following convention:
	// - all events are exported constants whose names are in SCREAMING_SNAKE_CASE
	// and start with EVT_
	// - all handlers have the names of their events, sans the EVT_, are in CamelCase
	// and have the prefix 'on'
	// E.g. the handler for EVT_SOMETHING is onSomething
	Object.keys(handlers)
		.filter(key => key.startsWith('EVT_'))
		.forEach(key => {
			let handlerName = key
				// Lop off EVT_
				.slice(4)
				.split('_')
				// Capitalize the first letter in each word
				.map(word => word[0].toUpperCase() + word.slice(1).toLowerCase())
				.join('');
			handlerName = `on${handlerName}`;

			socket.on(handlers[key], handlers[handlerName]);
		});	
});