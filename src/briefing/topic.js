import * as filters from './topic-filters.js';
import pug from 'pug';
import * as sass from 'sass';
import { toSass } from 'sass-cast';
import { screamingSnakeCase } from '../util/util.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BASE_DIR } from '../init/paths.js';

const basename = name => name !== 'Topic' && name.endsWith('Topic') ? name.slice(0, -5) : name;

/**
 * `Topic` automates the process of rendering the HTML and CSS for a single topic. This includes
 * acquiring the necessary data. Indeed this is the core benefit of this class: by providing overridable
 * hooks for getting data, topic building can be reduced to data provision, reducing clutter and
 * repetetive boilerplate code. 
 */
export default class Topic {
	/**
	 * The pug template to use for rendering. This is set to an auto-detected value by
	 * the constructor, but can be overwritten if the constructor-set value needs to be changed.
	 */
	pugFile;
	/**
	 * The scss template to use for rendering. This is set to an auto-detected value by
	 * the constructor, but can be overwritten if the constructor-set value needs to be changed.
	 */
	scssFile;

	/**
	 * The string to use as a heading for the topic.
	 */
	caption;

	/**
	 * Creates a new `Topic` based on the provided `topicName`. `topicName` is used to 
	 * set the new topic's `pugFile` and `scssFile` properties to initial values. If it 
	 * is not provided, the constructor will attempt to guess at the correct value based
	 * on the name of the (sub-)class being instantiated by converting it to snake case 
	 * (like "snake_case").
	 *
	 * Additionally, the caption for the topic is initialized. The caption is intendend to be
	 * a human-readable title for the topic. It is inferred from the topic's class name by 
	 * inserting spaces before any capital letters except the first letter of the string. 
	 * 
	 * @param  {String} [topicName] The topic name to use when setting initial values for
	 * `this.pugFile` and `this.scssFile`.
	 * @param  {Object} providers Any data providers to be made available when `getData` is
	 * called. Any properties from this object are copied over to the new topic. This should
	 * be at least `{ gameObjectProvider }`, but may have other providers as well.
	 */
	constructor(topicName, providers) {
		if (typeof topicName !== 'string') {
			providers = topicName;
			topicName = screamingSnakeCase(basename(this.constructor.name)).toLowerCase();
		}
		const topicPath = join(dirname(fileURLToPath(import.meta.url)), 'topics', topicName);
		this.pugFile = join(topicPath, `${topicName}.pug`);
		this.scssFile = join(topicPath, `${topicName}.scss`);
		
		// Infer caption from class name by removing suffix 'Topic' if present...
		this.caption = basename(this.constructor.name);
		// ... and inserting spaces before any capital letter that is not the first letter of the string
		this.caption = this.caption[0].toUpperCase() + this.caption.slice(1).replaceAll(/[A-Z]/g, ' $&');

		Object.assign(this, providers);
	}

	/**
	 * Called to provide the data to be passed to pug template rendering as a `locals` object.
	 *
	 * This may be overridden by subclasses as appropriate. The default implementation returns an object
	 * `{ battle, options, teams, ships }`, where 
	 * - `battle` and `options` are the same as were passed in,
	 * - `ships` is an array of `Ship`s participating in the battle, and 
	 * - `teams` is an object `{ player, allies, enemies }` with the ship id's of the respective teams. 
	 * `player` is a scalar, `allies` and `enemies` are arrays. `allies` includes `player`.
	 * 
	 * `ships` is filtered for duplicates, and filtered with the "teams" and "classes" default filters as per
	 * `options.filter`, then sorted to conform to the order displayed in the game's battle load screen.
	 * 
	 * If no `GameObjectFactory` was set when the topic was created, `ships` will be an array of ship id's.
	 * @param  {Battle} battle  The battle to generate content for.
	 * @param  {Object} [options] The topic's options as defined in the agenda.
	 * @returns {Object} An object `{ battle, options, teams, ships }` as described above.
	 */
	async getPugData(battle, options) {
		const teams = {
			allies: battle.allies.map(vehicle => vehicle.shipId),
			enemies: battle.enemies.map(vehicle => vehicle.shipId),
			player: battle.player.shipId
		}
		teams.allies.push(teams.player);

		let ships = battle.vehicles
			.map(vehicle => vehicle.shipId)
			.filter(filters.duplicates)
			.filter(filters.teams(teams, options?.filter?.teams))

		if (this.gameObjectProvider)
			ships = (await Promise.all(ships
				.map(id => this.gameObjectProvider.createGameObject(id))))
				.filter(filters.classes(options?.filter?.classes))
				.sort(filters.loadScreenSort);

		return {
			battle,
			teams,
			ships,
			options
		}
	}

	/**
	 * Called to provide the data to be passed to scss stylesheet compilation. Since Sass doesn't allow
	 * for data to be passed in, this needs to be a function-valued object whose values conform to the requirements
	 * of sass custom functions. 
	 *
	 * This may be overridden by subclasses as appropriate. The default implementation simply provides a function 
	 * `option($name)` giving access to the values of the `options` object.
	 * @see {@link https://sass-lang.com/documentation/js-api/modules#CustomFunction}
	 */
	async getScssData(battle, options) {
		return {
			"option($name)": args => {
				let name = args[0];
				// Make sure name is actually a SassString. This will throw if it isn't. 
				name.assertString();
				// name is a SassString, get its contents (i.e., convert from a SassString object to a Javascript string)
				name = name.text;
				// Get the value of that option, if any
				let val = options?.[name];
				// Convert back to a Sass value
				return toSass(val);
			}
		}
	}

	/**
	 * Calls `getPugData` to obtain a `locals` object and then renders the template `this.pugFile` with it.
	 * @param  {Battle} battle  Passed through to `getPugData`.
	 * @param  {Object} [options] Passed through to `getPugData`.
	 * @return {string}         The rendered template as a string.
	 */
	async renderHtml(battle, options) {
		return pug.renderFile(this.pugFile, await this.getPugData(battle, options));
	}

	/**
	 * Calls `getScssData` to obtain an object of Sass custom functions and then compiles the stylesheet template 
	 * `this.scssFile` with it.
	 * @param  {Battle} battle  Passed through to `getScssData`.
	 * @param  {Object} [options] Passed through to `getScssData`.
	 * @return {string}         The rendered stylesheet as a string.
	 */
	async renderCss(battle, options) {
		return sass.compile(this.scssFile, {
			loadPaths: [join(BASE_DIR,'node_modules')],
			functions: {
				...await this.getScssData(battle, options)
			}
		}).css;
	}

	/**
	 * Returns both the rendered HTML and CSS for the topic. 
	 * @param  {Battle} battle  Passed through to `renderHtml` and `renderCss`
	 * @param  {Object} options Passed through to `renderHtml` and `renderCss`
	 * @return {Object}         An object `{ html, css }` with the results of the renderings.
	 */
	async render(battle, options) {
		return {
			html: await this.renderHtml(battle, options),
			css: await this.renderCss(battle, options)
		}
	}
}
