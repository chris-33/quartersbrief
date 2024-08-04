// SVG does not respect z-order; instead, it puts whichever element is drawn last on top.
// So we will set up a mutation observer on all plots that dynamically shifts whichever plot is highlighted
// to the top and back to its original place.


// A map to hold the next sibling of highlighted plots, so we can re-insert them in their
// original positions when highlighting ends.
const siblings = new Map();
const observer = new MutationObserver(function onHighlighted(mutations) {
	mutations.forEach(mutation => {
		const highlighting = !mutation.oldValue.includes('highlighted');
		if (highlighting) {
			siblings.set(mutation.target, mutation.target.nextSibling);
			mutation.target.parentNode.appendChild(mutation.target);
		} else {
			mutation.target.parentNode.insertBefore(mutation.target, siblings.get(mutation.target));
		}
	});
});

document.currentScript.parentElement
	.querySelectorAll('.ship')
	.forEach(plot => observer.observe(plot, {
		attributes: true,
		attributeFilter: [ 'class' ],
		attributeOldValue: true
	}));
