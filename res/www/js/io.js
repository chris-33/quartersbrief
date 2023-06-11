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
	// Lock the briefing, so new briefings/topics arriving will have to wait
	briefingLock = lock();
	// Wait for any topics that are still being animated on the previous briefing in to finish
	await Promise.all(topicLocks);
	// Reset topic locks
	topicLocks = [];

	// Animate out previous briefing
	const briefing = document.getElementById('briefing');

	let anim = briefing.getAnimations().find(anim => anim.animationName === 'briefing-vanish');
	if (anim) {
		anim.play();
		await anim.finished;
	}

	const briefingStylesheet = document.adoptedStyleSheets[0] ?? new CSSStyleSheet();
	document.adoptedStyleSheets = [ briefingStylesheet ];
	await briefingStylesheet.replace(css);
	
	briefing.innerHTML = '';
	anim = briefing.getAnimations().find(anim => anim.animationName === 'briefing-appear');
	if (anim) {
		anim.play();
		await anim.finished;
	}

	const contents = document.createRange().createContextualFragment(html);
	briefing.append(contents);
	// Animate in all direct children of the briefing
	const anims = Array
		.from(briefing.children)
		.map(element => {
			let anim = element.getAnimations().find(anim => anim.animationName === 'briefing-content-appear');
			if (anim) {
				anim.play();
				return anim.finished;
			}
			return null;
		})
		.filter(p => p !== null);

	await Promise.all(anims);

	briefingLock.release();
}

export async function onBriefingTopic(id, index, { html, css }) {
	// Discard topics for briefings other than the current one
	if (id !== current) return;
	// Defer until the briefing is ready to receive topics
	// (This will prevent topics from getting animated in while the briefing itself is still being animated in)
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
	// Animate out the topic loading indicator, if an animation for that has been set
	let anim = topic.getAnimations().find(anim => anim.animationName === 'topic-content-vanish');
	if (anim) {
		anim.play();
		await anim.finished;
	}	
	topic.classList.remove('loading');
	
	// Turn new topic HTML into a DocumentFragment, run makeDetails on it and then replace the topic's loading spinner with the actual topic contents
	const newTopic = document.createRange().createContextualFragment(html);
	makeDetails(newTopic);
	topic.innerHTML = '';
	topic.append(newTopic);
	
	// Animate in the topic content, if an animation for that has been set
	anim = topic.getAnimations().find(anim => anim.animationName === 'topic-content-appear');
	if (anim) {
		anim.play();
		await anim.finished;
	}

	// Release the topic lock after all animations have finished
	topicLock.release();
}


// No-ops. This way we can already register them on the socket instance,
// so if we ever want to do anything, we just need to change these and not
// have to remember to register them as event handlers as well. :)
export async function onBriefingFinish() {}
export async function onBattleStart() {}
export async function onBattleEnd() {}