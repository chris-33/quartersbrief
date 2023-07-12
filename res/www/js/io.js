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

// Locks to prevent briefing/topic animations from being superimposed on each other. This also prevents a race condition
// between briefing and topics, where extremely fast-arriving topics (i.e. arriving while the old briefing is still being 
// animated out) would never get shown, because they would be added to the old briefing.
// 
// Concurrency rules:
// - A new briefing may only be animated in if the old is not still being animated in
// - A new briefing may only be animated in if no topics on the old briefing are still being animated in
// - A new topic may only be animated in if the briefing is done being animated in
// - More than one topic may be animated in at a time
let briefingLock;
let topicLocks = [];

let current;

export async function onBriefingStart({ id, html, css }) {	
	// Remember the id of the latest received briefing so we can discard incoming topics for all others
	current = id;

	// Wait for the briefing to become available for exchange
	// (This will delay the briefing start animation if another briefing is currently being animated in)	
	await briefingLock;

	const briefing = document.getElementById('briefing');
	const previousVisibility = briefing.style.visibility;

	// Lock the briefing, so new briefings/topics arriving will have to wait
	briefingLock = lock();
	try {
		// Wait for any topics that are still being animated on the previous briefing in to finish
		await Promise.all(topicLocks);
		// Reset topic locks
		topicLocks = [];

		// Add class "exiting" and wait for animations to finish (if any)
		briefing.classList.add('exiting');
		await Promise.all(briefing.getAnimations().map(anim => anim.finished));

		// Hide element to prevent flash of content as stylesheet gets replaced
		briefing.style.visibility = 'hidden';
		briefing.classList.remove('exiting');

		const briefingStylesheet = document.adoptedStyleSheets[0] ?? new CSSStyleSheet();
		document.adoptedStyleSheets = [ briefingStylesheet ];
		await briefingStylesheet.replace(css);
		
		briefing.innerHTML = '';
		briefing.style.visibility = previousVisibility;

		// Add class "entering" and wait for animations to finish (if any)
		briefing.classList.add('entering');
		await Promise.all(briefing.getAnimations().map(anim => anim.finished));

		const contents = document.createRange().createContextualFragment(html);
		briefing.append(contents);
		// Wait for enter animation of all direct children of the briefing
		await Promise.all(Array
			.from(briefing.children)
			.flatMap(element => element.getAnimations())
			.map(anim => anim.finshed));

		briefing.classList.remove('entering');
	} finally {
		briefingLock.release();
		// Restore visibility in case of an error within the try-block
		briefing.style.visibility = previousVisibility;
	}
}

export async function onBriefingTopic(id, index, { html, css }) {
	// Defer until the briefing is ready to receive topics
	// (This will prevent topics from getting animated in while the briefing itself is still being animated in)
	await briefingLock;

	// Await the briefing lock a second time.
	// This is a workaround to avoid a race condition between topics and briefing.
	// Because onBriefingStart first awaits the current briefing lock (to avoid animating a new briefing over a
	// still-animating previous one), there is a window of time where the new briefing has not yet been locked,
	// and onBriefingTopic can be executed. 
	// The end result is topics get "lost" because the handler errors, as the DOM to insert the topic into doesn't
	// exist yet.
	// Awaiting the lock a second time solves the issue, but it is an ugly hack. We really need a better way to
	// ensure handlers run when they are supposed to.
	// @todo Better arbitration for briefing and topics loading in
	await briefingLock;

	// Discard topics for briefings other than the current one
	if (id !== current) return;

	const topic = document.querySelector(`#topic-${index} .topic-content`);

	// Add a new topic lock
	const topicLock = lock();	
	topicLocks.push(topicLock);
	try {
		const stylesheet = new CSSStyleSheet();
		await stylesheet.replace(css);
		// Chromium < 99 does not allow to push() to adoptedStyleSheets
		// https://chromestatus.com/feature/5638996492288000
		document.adoptedStyleSheets = [ ...document.adoptedStyleSheets, stylesheet ];

		// Add class "exiting" and wait for animations to finish (if any)
		topic.classList.add('exiting');
		await Promise.all(topic.getAnimations().map(anim => anim.finished));
		topic.classList.remove('loading');
		topic.classList.remove('exiting');

		// No need to turn off visibility
		
		// Turn new topic HTML into a DocumentFragment, run makeDetails on it and then replace the topic's loading spinner with the actual topic contents
		const newTopic = document.createRange().createContextualFragment(html);
		makeDetails(newTopic);
		// Move all details overlays from the topic proper to the dedicated overlay pane
		newTopic.querySelectorAll(`aside.details`).forEach(details => {
			details.remove();
			document.getElementById(`topic-${index}-overlay`).append(details);
		});
		topic.innerHTML = '';
		topic.append(newTopic);
		
		// Add class "entering" and wait for animations to finish (if any)
		topic.classList.add('entering');
		await Promise.all(topic.getAnimations().map(anim => anim.finished));
		topic.classList.remove('entering');
	} finally {
		// Release the topic lock after all animations have finished
		topicLock.release();
	}
}


// No-ops. This way we can already register them on the socket instance,
// so if we ever want to do anything, we just need to change these and not
// have to remember to register them as event handlers as well. :)
export async function onBriefingFinish() {}
export async function onBattleStart() {}
export async function onBattleEnd() {}