import Supplier from './supplier.js';
import pipe from 'pipe-functions';
import clone from 'lodash/cloneDeep.js';
import { compile, perform } from 'object-selectors';
import * as processors from './processors.js';
import fs from 'fs/promises';
import path from 'path';

import Ship from '../model/ship.js';
import Modernization from '../model/modernization.js';
import Consumable from '../model/consumable.js';
import Captain from '../model/captain.js';
import Signal from '../model/signal.js';
import Gun from '../model/gun.js';
import Torpedo from '../model/torpedo.js';
import Shell from '../model/shell.js';

import Artillery from '../model/modules/artillery.js';
import Torpedoes from '../model/modules/torpedoes.js';
import Hull from '../model/modules/hull.js';
import Engine from '../model/modules/engine.js';

export default class GameObjectSupplier extends Supplier {

	constructor(sourcepath, labeler) {
		super();
		this.sourcepath = sourcepath;
		this.processors = new GameObjectSupplier.Processors(this, labeler);
	}

	async recover(designator) {
		let obj = JSON.parse(await fs.readFile(path.format({
			dir: this.sourcepath,
			name: designator,
			ext: '.json'
		})));

		// If there are processors for this kind of game object, run them
		if (this.processors?.[obj?.typeinfo?.type]) {
			const processorsForType = this.processors[obj.typeinfo.type];
			for (let { selector, processors } of processorsForType) {
				const p = perform(selector, async (value, prop, ctx) => {
					const rootTarget = obj === ctx[prop];

					// Create a new list of processors with set prop and ctx
					// This is so we can pass these to the processors as the value is passed through the pipe
					processors = processors.map(fn => x => fn(x, prop, ctx))
					value = await pipe(value, ...processors);
					// By default applicator functions may only be synchronous.
					// So manually assign the reference target after the processing chain resolves.
					if (rootTarget)
						obj = value;
					else
						ctx[prop] = value;
					return value;
				}, obj, { mode: 'lenient' }); // Run in lenient mode, because we want missing properties to just not be processed instead of causing an error
				// If the selector was ambiguous, p might be an ARRAY of promises.
				// Check for this, and await either p itself, or all its contained promises.
				// This is necessary to avoid race conditions (awaiting a non-Promise resolves immediately)
				// and to propagate errors from the processors
				await (Array.isArray(p) ? Promise.all(p) : p);
			}
		}
		return obj;
	}
}

GameObjectSupplier.Processors = class {
	/**
	 * The default conversion table.
	 */
	static CONVERSIONS = {
		'Ship': Ship,
		'Modernization': Modernization,
		'Ability': Consumable,
		'Crew': Captain,
		'Exterior': { 
			'Flags': Signal
		},
		'Gun': Gun,
		'Projectile': {
			'Torpedo': Torpedo,
			'Artillery': Shell
		}
	}
	
	constructor(supplier, labeler) {
		// Helper function to compile the selector of a single processor entry
		const compileSelector = ({ selector, processors }) => ({ selector: compile(selector), processors });

		const label = gameObject => labeler.label(gameObject);

		const expand = processors.expand.bind(null, supplier);
		const convert = processors.convert.bind(null, GameObjectSupplier.Processors.CONVERSIONS);

		return {
			'Ability': [ 
				{ selector: '::root', processors: [ label, convert ] } 
			].map(compileSelector),

			'Modernization': [ 
				{ selector: '::root', processors: [ label, convert ] } 
			].map(compileSelector),

			'Crew': [ 
				{ selector: '::root', processors: [ label, convert ] } 
			].map(compileSelector),

			'Exterior': [ 
				{ selector: '::root', processors: [ label, convert ] } 
			].map(compileSelector),

			'Projectile': [ 
				{ selector: '::root', processors: [ label, convert ] } 
			].map(compileSelector),

			'Ship': [
				// Expansion of inline gun definitions:
				{ selector: '*.*[typeinfo.type===Gun].ammoList.*', processors: [ 
					expand, convert, 
					// Since ammos don't have nested DataObjects, we can just do a regular clone here
					ammo => new ammo.constructor(clone(ammo._data)) ] },
				{ selector: '*.*[typeinfo.type===Gun]', processors: [ convert ] }, // Gun objects are inline, so no expansion here
				
				// Module conversion:
				{ selector: '*[*.typeinfo.type===Gun][*.typeinfo.species===Main]', processors: [ mdl => new Artillery(mdl) ]},
				{ selector: '*[*.typeinfo.type===Gun][*.typeinfo.species===Torpedo]', processors: [ mdl => new Torpedoes(mdl) ]},
				{ selector: '*[draft]', processors: [ mdl => new Hull(mdl) ]},
				{ selector: '*[forwardEngineForsag]', processors: [ mdl => new Engine(mdl) ]},


				{ selector: 'defaultCrew', processors: [ expand, convert ] },
				// Change ship consumables from the format in which they are in the game files [ <consumable reference>, <flavor> ]
				// to a Consumable object with the flavor properties copied directly onto the consumable
				{ selector: 'ShipAbilities.AbilitySlot*.abils.*', processors: [
						// Project to data of expanded reference
						// (because convert will have automatically been run when recovering the ability)
						async ([ abil, flavor ]) => [ (await expand(abil))._data, flavor ],						
						// Copy appropriate flavor into data root
						// Need to make a shallow copy to avoid changing the master consumable within the cache
						async ([ abil, flavor ]) => Object.assign({}, abil, abil[flavor]), 
						convert 
					] },
				{ selector: 'ShipUpgradeInfo', processors: [ processors.buildResearchTree ]},
				{ selector: 'ShipUpgradeInfo', processors: [
					// @todo Implement into a single selector once object-selectors passes root information into perform-functions
					function createModule(research, prop, ctx, root) {
						compile('*.*.components.*.*').perform(function lookup(name) {
							return ctx[name];
						}, research);
						
						return research;
					}
				]},
				{ selector: '::root', processors: [ label, convert ] }
			].map(compileSelector)
		}
	}
}
