import makeDetails from './details.js';

export const EVT_BRIEFING_START = 'briefingstart';
export const EVT_BRIEFING_TOPIC = 'briefingtopic';
export const EVT_BRIEFING_FINISH = 'briefingfinish';
export const EVT_BATTLE_START = 'battlestart';
export const EVT_BATTLE_END = 'battleend';

function lock() {
	let release;
	const result = new Promise(resolve => {
		release = resolve;
	});
	result.release = release;
	return result;
}

const FADE_OUT = [
	{ opacity: 1, easing: 'ease-in' },
	{ opacity: 0 }	
];
const FADE_IN = [
	{ opacity: 0, transform: 'translateY(3rem) scale(0.7)', easing: 'linear' },
	{ transform: 'translateY(3rem) scale(1)', offset: 0.2, easing: 'ease-out' },
	{ opacity: 1, },
];
const REVEAL = [
	{ transform: 'scale(0, 0.1)', },
	{ transform: 'scale(1, 0.1)', offset: 0.4 },
	{ transform: 'scale(1, 0.1)', offset: 0.6 },
	{ transform: 'scale(1)' }
];
const SLIDE_OUT = [
	{},
	{ transform: 'translateX(-100vw)' }
];
const ANIMATION_DURATION = 1000;

// Guard against topics getting delivered extremely quickly, i.e. between briefing start and
// the completion of its event handler (because onBriefingStart is asynchronous).
// This would result in the topic getting "lost", because it would be inserted into the DOM
// of the old briefing.
let briefingLock;
let topicLocks = [];

let current;

export async function onBriefingStart({ id, html, css }) {	
	current = id;
	
	// Lock the briefing, so new topics arriving will have to wait
	briefingLock = lock();
	// Wait for those topics that are already being animated in to finish
	await Promise.all(topicLocks);
	// Reset topic locks
	topicLocks = [];

	// Animate out previous briefing
	const briefing = document.getElementById('briefing');
	await briefing.animate(SLIDE_OUT, {
		duration: ANIMATION_DURATION,
		fill: 'forwards'
	}).finished;

	const briefingStylesheet = document.adoptedStyleSheets[0] ?? new CSSStyleSheet();
	document.adoptedStyleSheets = [ briefingStylesheet ];
	await briefingStylesheet.replace(css);

	// @fixme This introduces a race condition. If a second briefing starts while the reveal animation of the first is still playing, BOTH will be appended to the briefing content area
	briefing.innerHTML = '';
	await briefing.animate(REVEAL, {
		duration: ANIMATION_DURATION,
		easing: 'ease-in-out'
	}).finished;

	const contents = document.createRange().createContextualFragment(html);
	const anims = Array.from(contents.children).map(element => element.animate(FADE_IN, ANIMATION_DURATION).finished);
	briefing.append(contents);
	await Promise.all(anims);

	briefingLock.release();
}

export async function onBriefingTopic(id, index, { html, css }) {
	if (id !== current) return;
	// Defer until we're ready to show topics
	await briefingLock;

	// Add a new topic lock
	const topicLock = lock();	
	topicLocks.push(topicLock);

	const stylesheet = new CSSStyleSheet();
	await stylesheet.replace(css);
	// Chromium < 99 does not allow to push() to adoptedStyleSheets
	// https://chromestatus.com/feature/5638996492288000
	document.adoptedStyleSheets = [ ...document.adoptedStyleSheets, stylesheet ];


	const topic = document.querySelector(`#topic-${index} .topic-content`);
	await topic.animate(FADE_OUT, ANIMATION_DURATION).finished;
	topic.classList.remove('loading');
	
	// Turn new topic HTML into a DocumentFragment, run makeDetails on it and then replace the topic's loading spinner with the actual topic contents
	const newTopic = document.createRange().createContextualFragment(html);
	makeDetails(newTopic);
	topic.innerHTML = '';
	topic.append(newTopic);
	
	await topic.animate(FADE_IN, ANIMATION_DURATION).finished;

	topicLock.release();
}


// No-ops. This way we can already register them on the socket instance,
// so if we ever want to do anything, we just need to change these and not
// have to remember to register them as event handlers as well. :)
export async function onBriefingFinish() {}
export async function onBattleStart() {}
export async function onBattleEnd() {}