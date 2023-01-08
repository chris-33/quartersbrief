import occlude from './occlude.js';
import { expose } from 'threads/worker';

function occludePiece(piece, model, viewAxis) {
	for (let id in model) {
		occlude(piece, model[id], viewAxis);
		if (piece.length === 0)
			break;
	}
	return piece;
}

expose(occludePiece);