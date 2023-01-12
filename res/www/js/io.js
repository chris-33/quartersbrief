import makeDetails from './details.js';

export const EVT_BRIEFING_START = 'briefingstart';
export const EVT_BRIEFING_TOPIC = 'briefingtopic';
export const EVT_BRIEFING_FINISH = 'briefingfinish';
export const EVT_BATTLE_START = 'battlestart';
export const EVT_BATTLE_END = 'battleend';

const FADE_OUT = [
	{ opacity: 1, easing: 'ease-in' },
	{ opacity: 0, transform: 'translateY(3rem)' }	
];
const FADE_IN = [
	{ opacity: 0, transform: 'translateY(3rem) scale(0.7)', easing: 'linear' },
	{ transform: 'translateY(3rem) scale(1)', offset: 0.2, easing: 'ease-out' },
	{ opacity: 1, },
];
const FLASH = [
	{ backgroundColor: 'revert', },
	{ backgroundColor: 'hsl(200deg, 75%, 90%)', },
	{ backgroundColor: 'revert', }
]
const FADE_TIME = 750;

// Guard against topics getting delivered extremely quickly, i.e. between briefing start and
// the completion of its event handler (because onBriefingStart is asynchronous).
// This would result in the topic getting "lost", because it would be inserted into the DOM
// of the old briefing.
let readyForTopics;

export async function onBriefingStart({ html, css }) {	
	let ready;
	readyForTopics = new Promise(resolve => ready = resolve);

	const briefingStylesheet = document.adoptedStyleSheets[0] ?? new CSSStyleSheet();
	document.adoptedStyleSheets = [ briefingStylesheet ];
	await briefingStylesheet.replace(css);

	const briefing = document.getElementById('briefing');
	briefing.innerHTML = '';
	briefing.append(document.createRange().createContextualFragment(html));
	await briefing.animate([
		{ transform: 'scale(0, 0.1)', },
		{ transform: 'scale(1, 0.1)', offset: 0.4 },
		{ transform: 'scale(1, 0.1)', offset: 0.6 },
		{ transform: 'scale(1)' }
	], {
		duration: 750,
		easing: 'ease-in-out'
	}).finished;

	ready();
}

export async function onBriefingTopic(index, { html, css }) {
	const stylesheet = new CSSStyleSheet();
	await stylesheet.replace(css);
	// Chromium < 99 does not allow to push() to adoptedStyleSheets
	// https://chromestatus.com/feature/5638996492288000
	document.adoptedStyleSheets = [ ...document.adoptedStyleSheets, stylesheet ];

	// Defer until we're ready to show topics
	await readyForTopics;

	const topic = document.querySelector(`#topic-${index} .topic-content`);
	await topic.animate(FADE_OUT, FADE_TIME).finished;
	topic.classList.remove('loading');
	
	// Turn new topic HTML into a DocumentFragment, run makeDetails on it and then replace the topic's loading spinner with the actual topic contents
	const newTopic = document.createRange().createContextualFragment(html);
	makeDetails(newTopic);
	topic.innerHTML = '';
	topic.append(newTopic);
	
	await topic.animate(FADE_IN, FADE_TIME).finished;
	await topic.animate(FLASH, FADE_TIME / 2).finished;
}

// No-ops. This way we can already register them on the socket instance,
// so if we ever want to do anything, we just need to change these and not
// have to remember to register them as event handlers as well. :)
export async function onBriefingFinish() {}
export async function onBattleStart() {}
export async function onBattleEnd() {}