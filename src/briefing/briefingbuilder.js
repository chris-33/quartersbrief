import pug from 'pug';
import sass from 'sass';
import rootlog from 'loglevel';
import { readFileSync } from 'fs';
import clone from 'clone';

/**
 * The `BriefingBuilder` constructs a briefing for a given battle and agenda. It dynamically imports the 
 * topic builder for each topic of the agenda, then calls this with the battle and a `GameObjectFactory`.
 * If no topic builder could be found, it constructs a special `error topic` for that topic, but finishes
 * the briefing otherwise.
 *
 * Topic content is constructed by getting each topic's dedicated topic builder. Topic builders are functions
 * of length 2 that return an object with properties `html` and `scss` containing the briefing's content 
 * and styling respectively. (Note that the property here is still `**s**css`. In the similarly composed 
 * object returned by {@link BriefingBuilder#build}, this becomes `css`.) 
 *
 * Topic builders are retrieved by calling `{@link #getTopicBuilder}`, which in turn attempts a dynamic import of
 * the module for the topic builder. Topic builder modules are expected to be found in `topics/<topicname>/<topicname>.js`
 * and export a function as described above as default. The function may be `async`.
 */
class BriefingBuilder {
	#briefingHTML;
	#briefingCSS(briefing) {
		// @todo Cache contents of briefing.scss to avoid synchronous reads on every refresh
		let src = `${readFileSync('src/briefing/briefing.scss', 'utf8')}${briefing.topics.map(topic => topic.scss).join('')}`;
		return sass.compileString(src, {
			// Since we're compiling from a string, we need to manually provide the base path for imports:
			loadPaths: [ 'src/briefing' ]
		}).css;
	}

	/**
	 * Creates a new `BriefingBuilder`.
	 * @param  {GameObjectFactory} [gameObjectFactory] A game object factory that will be passed to each
	 * topic builder. It is possible to create a briefing builder without a game object factory, but note 
	 * that topic builders will then also not have one available.
	 */
	constructor(gameObjectFactory) {
		this.gameObjectFactory = gameObjectFactory;
		this.#briefingHTML = pug.compileFile('src/briefing/briefing.pug');
	}


	/**
	 * Dynamically imports the topic builder for the given `topic`. Topic builders will be expected
	 * to be a file with the topic's name and extension '.js' in a subdirectory of the topic's name,
	 * exporting a function of length 2 as default.
	 * The function may be async and must return an object containing the topic's html as a `string` 
	 * in a property `html`, and (optionally) the topic's styling as a `string` in a property `scss`.
	 * Topic builder's do not need to worry about polluting other topic's styles, as topic styles
	 * are automatically scoped.
	 * @param  {String} topic The topic for which to get a topic builder.
	 * @return {Promise}       A promise that resolves to the topic builder, or rejects if none could be found.
	 */
	getTopicBuilder(topic) {
		const t0 = Date.now();
		return import(`./topics/${topic}/${topic}.js`)
			.then(x => (
				rootlog.getLogger(this.constructor.name).debug(`Loaded topic builder ${topic} in ${Date.now() - t0}ms`),
				x
			));
	}

	/**
	 * Constructs an error topic for missing topic builders.
	 * @param  {Error} err The error that prevented a topic builder from being available.
	 * @return {String}     A string containing the HTML for the error topic.
	 */
	buildErrorTopic(err) {
		return `There was an error while making the topic: ${err}`;
	}

	/**
	 * Builds a briefing using the battle and the agenda.
	 * @param  {Battle} battle            The battle for which to build the briefing.
	 * @param  {Agenda} agenda            The agenda by which to build the briefing.
	 * @return {Object} An object containing the HTML for the briefing in `html` and the
	 * scoped styling for the briefing in `css`.
	 */
	async build(battle, agenda) {
		// Helper function to infer a caption from a topic name by
		// - replacing all underscores with spaces
		// - capitalizing the first letter of the topic name
		// - capitalizing the first letter after an underscore
		function inferCaption(topicName) {			
			return topicName.split('_')
						.map(substr => substr.charAt(0).toUpperCase() + substr.substring(1))
						.join(' ');
		}

		if (!agenda || !agenda.topics) return {};
		let briefing = { 
			topics: new Array(agenda.getTopicNames().length)
		};

		const t0 = Date.now();
		const dedicatedlog = rootlog.getLogger(this.constructor.name);

		// For each briefing content part, get the dedicated builder for that part and build it
		let builtTopics = await Promise.allSettled(agenda.getTopicNames().map(topicName => {
				rootlog.debug(`Building topic ${topicName}`);
				return this
					.getTopicBuilder(topicName)
					.then(dynimport => dynimport.default(
						// Pass a separate copy of the battle to each topic builder
						clone(battle), 
						this.gameObjectFactory, 
						agenda.topics[topicName]))
					.then(x => (
						dedicatedlog.debug(`Built topic ${topicName} in ${Date.now() -t0}ms`),
						x
					));
		}));

		// Assign it to the layout pane dedicated to it for successful builds
		// Or build an error topic for unsuccessful ones. (That includes unsuccessful imports)
		for (let i = 0; i < builtTopics.length; i++) {
			let dynimport = builtTopics[i];
			if (dynimport.status === 'fulfilled') {
				briefing.topics[i] = {
					html: dynimport.value.html,
					// Scope topic SCSS by nesting it inside the topic <div>
					// If the topic builder returned no SCSS, use ''
					scss: `#topic-${i} {${dynimport.value.scss ?? ''}}`,
					// Use the caption the topic builder provided if any, otherwise try to infer a 
					// caption from the topic's name
					caption: dynimport.value.caption ?? inferCaption(agenda.getTopicNames()[i])
				}				
			} else {
				rootlog.error(`Error while building topic ${agenda.getTopicNames()[i]}: ${dynimport.reason}`);
				briefing.topics[i] = {
					html: this.buildErrorTopic(dynimport.reason)
				}
			}
		}
		return {
			html: this.#briefingHTML(briefing),
			css: this.#briefingCSS(briefing)
		}
	}

	static buildNoBattle() {
		return {
			html: pug.renderFile('src/briefing/no-battle.pug'),
			css: sass.compile('src/briefing/message.scss').css
		}
	}

	static buildNoAgenda() {
		return {
			html: pug.renderFile('src/briefing/no-agenda.pug'),
			css: sass.compile('src/briefing/message.scss').css
		}
	}

}

export { BriefingBuilder }