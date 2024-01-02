/**
 * Calculates the module lines from the passed `upgradeInfo`. 
 */
export function getModuleLines(upgradeInfo) {
	/*
		This algorithm works as follows:
		It puts all the research definitions from the upgradeInfo into
		an array. As long as this array is not empty, it removes the
		first item from the START of the array and examines it.

		If this research research is the start of a module line (i.e., its prev 
		property equals ''), it is put at the start of the module
		line, and its distance metadata is set to 0.

		Otherwise, it tries to find the predecessor for the research in any
		module line. If none can be found, it must not have been processed yet.
		The research is appended again to the END of the list to be looked at
		again later.

		If a predecessor is found, the research's distance metadata is the predecessor's
		distance + 1. The research is then inserted into its module line such that
		the research to its left has a lower distance value, the research to its right
		a higher distance value. (This can also mean inserting at the start or end).
	 */

	// Helper function that returns true if the argument is a research definition
	function isResearchDefinition(o) {
		return typeof o === 'object'
			&& o.hasOwnProperty('components')
			&& o.hasOwnProperty('prev')
			&& o.hasOwnProperty('ucType');
	}		
	
	// Initialize metadata to be kept for each research.
	// We need this for the algorithm to work: For one thing,
	// we need to preserve the key names of the individual research 
	// definitions, because the "prev" property references those. 
	// Of course, we could just keep working with the upgradeInfo
	// object, but that makes handling and iterating over the research 
	// definitions much more convoluted: Lots of Object.keys(), Object.values()
	// and Object.entries() calls. So instead, we will project down to 
	// an array of research  definition objects soon, and keep key names
	// as metadata.
	// 
	// Keys for the metadata will be hashes of their corresponding
	// research objects.
	let metadata = new WeakMap();
	for (let researchKey in upgradeInfo) {
		let research  = upgradeInfo[researchKey];
		// Filter out primitives
		if (!isResearchDefinition(research )) continue;
		// Save the research 's key name in metadata
		metadata.set(upgradeInfo[researchKey], { name: researchKey });
	}
	// Now project down to research definition objects
	upgradeInfo = Object.values(upgradeInfo)
		// Filter out only those that are objects. Now contains
		// arrays of the form [keyname, object]
		.filter(obj => isResearchDefinition(obj));

	let moduleLines = {};

	// As long as there are still unprocessed upgradeInfos
	while (upgradeInfo.length > 0) {
		// Take the first one out
		let research = upgradeInfo.shift();	

		if (research.prev === '') {
			// This research is the beginning of the research line. Put it at the front.
			// If the research line does not exist yet, create one.
			if (!moduleLines[research.ucType]) moduleLines[research.ucType] = [];
			
			// Insert at the front
			moduleLines[research.ucType].splice(0, 0, research);
			// The research is at the start of the research line, so its distance is 0
			metadata.get(research).distance = 0;
		} else {
			// Try to find the research's predecessor. This might be in any research line.
			// The predecessor is that research whose metadata name property equals the prev
			// property of the research we're currently dealing with.
			let predecessor = null;
			for (let line of Object.values(moduleLines)) {
				predecessor = line.find(u => metadata.get(u).name === research.prev);
				if (predecessor) break;
			}

			if (!predecessor) {
				// If no predecessor has been found in any research line, it must not have
				// been processed yet. 
				// Put the research back into the list and continue with the next one.
				upgradeInfo.push(research);
				continue;
			} else {
				// If one has been found, our research's distance metadata is the predecesor's
				// distance plus one.
				metadata.get(research).distance = metadata.get(predecessor).distance + 1;
				// Initialize the research's research line if necessary
				if (!moduleLines[research.ucType]) moduleLines[research.ucType] = [];
				
				// Two short-hands that make the following code a little more readable
				let line = moduleLines[research.ucType];
				let distance = (u => metadata.get(u).distance);

				// Look for the insertion index. This is the place where the previous research
				// in the line has a lower distance, and the subsequent one has a higher distance.
				let index = -1;
				for (let i = -1; i < line.length; i++) {
					// The distances to the left and right
					let lowerbound; let upperbound;
					switch (i) {
						case -1: 
							lowerbound = Number.NEGATIVE_INFINITY; // If we are just starting out, the lowerbound -oo ...
							upperbound = distance(line[0]); // ... and the upper bound is the distance of the first item
							break;
						case line.length - 1: 
							lowerbound = distance(line[i]); // If we are at the end, the lower bound is the distance of the last item ...
							upperbound = Number.POSITIVE_INFINITY; // ... and the upper bound is +oo
							break;
						default:
							lowerbound = distance(line[i]); // In all other cases, the lower bound is the distance of the current item ...
							upperbound = distance(line[i+1]); // ... and the upper bound is the distance of the next item
					}
					// If we are between the lower and the upper bound, we have found the right place
					if (lowerbound < distance(research) && distance(research) < upperbound) {
						// Insert at the next index
						index = i + 1;
						// If we have already found the right place, no need to continue
						break;
					}
				}
				if (index > -1)
					line.splice(index, 0, research);
			}
		}
	}
	return moduleLines;
}