function group(rects) {
	let curr = [];
	const groups = [ curr ];
	for (let i = 0; i < rects.length; i++) {
		const rect = rects[i];
		
		if (i > 0 && curr[curr.length - 1].right < rect.left) {
			curr = [];
			groups.push(curr);
		}

		curr.push(rect);
	}
	return groups;
}

/**
 * Shifts the input rectangles so that they do not overlap on the y-axis, and distance from the center stays constant.
 *
 * **Input must be sorted (top to bottom).**
 * @param  {DOMRect[]} rects  The input rectangles
 * @param  {DOMRect} bounds The area available for laying them out
 * @return {Object[]}        An array `{x,y}` of the rectangles' new anchor points.
 */
function layoutRects(rects, bounds, spacing = 0) {
	const result = [];

	// Calculate the actual (current) height (including space) that labels are taking up
	const actual = rects[rects.length - 1].bottom - rects[0].top;
	// Calculate the sum of their individual heights. This is the MINIMUM space we will need if we forgo all spacing.
	let nominal = rects.reduce((prev, curr) => prev + curr.height, 0);
	// Reduce spacing if there is not enough room to use preferred value
	spacing = Math.min(spacing, (bounds.height - nominal) / (rects.length - 1));
	// Adjust nominal to include whatever space we can still add
	nominal += (rects.length - 1) * spacing;

	// Calculate the difference between the sum of individual heights and the total height
	// This is how much space we are missing	
	const overlap = -1 * (actual - nominal);

	// If there is no overlap, we don't need to layout
	if (overlap <= 0) {
		return rects.map(rect => ({ x: rect.x, y: rect.y }));
	}

	// Check how much space is available on the top and bottom with the way things are currently layed out
	const availTop = rects[0].top - bounds.top;
	const availBottom = bounds.bottom - rects[rects.length - 1].bottom;

	// Shift topmost rectangle up proportionally, then lay the rest out underneath
	let y = rects[0].y - overlap * availTop / (availTop + availBottom);
	for (let rect of rects) {
		const height = rect.height;
		// Anchor point is at the mid-height point of the label
		// Alignment of the label relative to anchor point is handled through CSS (translateY)
		y += height / 2;

		// Calculate length of radial through Pythagorean theorem.
		// We will use this to calculate the new x coordinate.
		const r = Math.sqrt((bounds.height - (rect.top - bounds.top)) ** 2 + (rect.left - bounds.left) ** 2);
		result.push({
			x: Math.sqrt(Math.max(0, r**2 - (bounds.height - (y - bounds.top)) ** 2)) + bounds.left,
			y: y - bounds.top
		});

		// Move to bottom of label (plus space) in preparation for next iteration
		y += height / 2 + spacing;
	}
	return result;
}

function layoutLabels(labels, bounds) {
	const SPACING = Number.parseFloat(window.getComputedStyle(labels[0]).fontSize);

	// Sort labels by their left edge. This makes splitting them easier
	labels.sort((el1, el2) => el1.getBoundingClientRect().left - el2.getBoundingClientRect().left);
	
	// Split labels into groups that do not overlap on the x-axis
	const groups = group(labels);
	groups.forEach(group => group.sort((label1, label2) => label1.getBoundingClientRect().top - label2.getBoundingClientRect().top));
	groups.sort((group1, group2) => group1[0].getBoundingClientRect().top - group2[0].getBoundingClientRect().top);

	for (let group of groups) {
		let rects = group.map(label => DOMRect.fromRect({
			x: Number.parseFloat(window.getComputedStyle(label).left),
			y: Number.parseFloat(window.getComputedStyle(label).top),
			width: Number.parseFloat(window.getComputedStyle(label).width),
			height: Number.parseFloat(window.getComputedStyle(label).height)
		}));

		const anchors = layoutRects(rects, bounds, SPACING);
		for (let i = 0; i < group.length; i++) {
			group[i].style.left = `${anchors[i].x}px`;
			group[i].style.top = `${anchors[i].y}px`;
		}
	}
}