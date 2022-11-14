import makeDetails from './details.js';

export const EVT_BRIEFING_START = 'briefingstart';
export const EVT_BRIEFING_TOPIC = 'briefingtopic';
export const EVT_BRIEFING_FINISH = 'briefingfinish';
export const EVT_BATTLE_START = 'battlestart';
export const EVT_BATTLE_END = 'battleend';

let readyForTopics;

export async function onBriefingStart({ html, css }) {
	let ready;
	readyForTopics = new Promise(resolve => ready = resolve);
	const briefingStylesheet = document.adoptedStyleSheets[0] ?? new CSSStyleSheet();
	document.adoptedStyleSheets = [ briefingStylesheet ];
	await briefingStylesheet.replace(css);
	document.getElementById('briefing').innerHTML = html;
	ready();
}

export async function onBriefingTopic(index, { html, css }) {
	const stylesheet = new CSSStyleSheet();
	await stylesheet.replace(css);
	document.adoptedStyleSheets.push(stylesheet);

	// Guard against topics getting delivered extremely quickly, i.e. between briefing start and
	// the completion of its event handler (because onBriefingStart is asynchronous).
	// This would result in the topic getting "lost", because it would be inserted into the DOM
	// of the old briefing.
	await readyForTopics;

	const topic = document.querySelector(`#topic-${index} .topic-content`);
	// Count how many transitions are started on the topic, so we can wait for all of them to finish.
	const transitions = new Set();
	topic.addEventListener('transitionstart', function(event) {
		transitions.add(event.propertyName);
	});
	// Helper function that creates a promise which resolves when the transition effect is done.
	// This allows for a cleaner code style, avoiding deeply nested event handlers ('callback hell')
	const transition = el => new Promise(resolve => {
		function resolveWhenAllDone(event) {
			transitions.delete(event.propertyName);
			if (transitions.size === 0)
				resolve();
		}
		// We will just resolve on transitioncancel, because otherwise a cancelled transition would prevent the topic from being shown. 
		// Clearly it's better to display it, even if the fancy effect is missing.
		el.addEventListener('transitionend', resolveWhenAllDone);
		el.addEventListener('transitioncancel', resolveWhenAllDone);
	});
	
	
	topic.classList.add('loaded');
	const START_TRANSITION_TIME = 50;
	// Give the browser x ms to start transitions. If after that time it hasn't started,
	// we're going to assume it's not going to (e.g. because the element has't actually
	// being rendered yet).
	await new Promise(resolve => setTimeout(resolve, START_TRANSITION_TIME));
	if (transitions.size > 0)
		await transition(topic);
	
	topic.innerHTML = '';
	// Remove inner HTML of topic
	// Turn new topic HTML into a DocumentFragment, run makeDetails on it and then append it
	const newTopic = document.createElement('template');
	newTopic.innerHTML = html;
	makeDetails(newTopic.content);
	topic.append(newTopic.content);
	// Remove class 'loading' to trigger fade-in transition
	topic.classList.remove('loading');

	await new Promise(resolve => setTimeout(resolve, START_TRANSITION_TIME));
	if (transitions.size > 0)
		await transition(topic);
	topic.classList.remove('loaded');
}

// No-ops. This way we can already register them on the socket instance,
// so if we ever want to do anything, we just need to change these and not
// have to remember to register them as event handlers as well. :)
export async function onBriefingFinish() {}
export async function onBattleStart() {}
export async function onBattleEnd() {}