import Supplier from './supplier.js';
import { apply } from 'object-selectors';
import fs from 'fs/promises';
import path from 'path';
import rootlog from 'loglevel';
import GameObject from '../model/gameobject.js';


export default class GameObjectSupplier extends Supplier {
	constructor(sourcepath, expansions, conversions) {
		super();
		this.sourcepath = sourcepath;
		this.expansions = expansions;
		this.conversions = conversions;
	}

	async recover(designator) {
		const convert = data => {
			const dedicatedlog = rootlog.getLogger(this.constructor.name);

			if (!(data?.typeinfo?.type)) {
				dedicatedlog.debug(`Returning object ${data?.name ?? data} as-is because it has no typeinfo.type`);
				return data;
			}

			let logstr = `Converting object ${data.name} of type ${data.typeinfo.type}`;

			let Constructor = this.conversions[data.typeinfo.type];
			if (typeof Constructor === 'object') {
				logstr += ` and species ${data.typeinfo.species}`;
				Constructor = Constructor[data.typeinfo.species];
			}

			if (!Constructor) Constructor = GameObject;

			logstr += ` into a ${Constructor.name}`;
			dedicatedlog.debug(logstr);

			return new Constructor(data);
		}

		// Helper function that takes the passed in reference and expands it if it is a string,
		// converts and returns it if it is an object.
		// 
		// This allows us to treat "inline references" - i.e. game objects directly included in
		// other game objects - the same as regular references. (This is frequently the case for
		// ships' guns, for instance.)
		const expand = reference => {
			if (typeof reference === 'object') 
				return convert(reference);
			else if (typeof reference === 'string')
				return this.get(reference);
			else throw new TypeError(`Illegal reference ${reference}`);
		}

		const obj = JSON.parse(await fs.readFile(path.format({
			dir: this.sourcepath,
			name: designator,
			ext: '.json'
		})));

		// If there are expansions for this game object, handle them
		if (this.expansions && obj?.typeinfo?.type && this.expansions[obj.typeinfo.type]) {
			// Apply a function to all selected references that expands the reference - this must be done asynchronously
			// because the reference target may need to be loaded from disk.
			// By default applicator functions may only be synchronous though.
			// So manually assign the reference target after expansion resolves.
			// Await all resultant promises. Once all of them resolve, all references in obj are expanded.
			await Promise.all(this.expansions[obj.typeinfo.type].map(selector => apply(selector, async (reference, prop, ctx) => {
					reference = await expand(reference);
					ctx[prop] = reference;
					return reference;
			}, obj)));
		}
			
		return convert(obj);
	}
}