import occlude from './occlude.js';
import clone from 'clone';
import polybool from 'polybooljs';
import { convertDown } from 'geometry-3d';

export default function viewFrom(model, viewAxis) {
	model = clone(model);

	// @todo Remove torpedo protection
	
	for (let id in model) {
		let piece = model[id];
		for (let otherId in model) {
			let otherPiece = model[otherId];
			occlude(piece, otherPiece, viewAxis);
			if (piece.length === 0)
				break;
		}
	}
	
	for (let id in model)
		model[id] = model[id].map(tri => convertDown(tri, viewAxis));

	for (let id in model) {
		let piece = model[id];
		let result;
		for (let tri of piece) {
			tri = {
				regions: [ tri ],
				inverted: false
			};
			if (!result)
				result = polybool.segments(tri)
			else
				result = polybool.selectUnion(polybool.combine(result, polybool.segments(tri)))
		}
		model[id] = polybool.polygon(result).regions;
	}

	return model;
}