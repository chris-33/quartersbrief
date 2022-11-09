import { EventEmitter } from 'events';
import pug from 'pug';
import sass from 'sass';
import rootlog from 'loglevel';
import clone from 'clone';

const renderTopic = pug.compileFile('src/briefing/topic.pug');
const renderBriefing = pug.compileFile('src/briefing/briefing.pug');

/**
 * The `BriefingBuilder` constructs a briefing for a given battle and agenda. It dynamically imports the 
 * topic builder for each topic of the agenda, then calls this with the battle and a `GameObjectFactory`.
 * If no topic builder could be found, it constructs a special `error topic` for that topic, but finishes
 * the briefing otherwise.
 *
 * Topic content is constructed by getting each topic's dedicated topic builder. Topic builders are functions
 * of length 2 that return an object with properties `html` and `css` containing the briefing's content 
 * and styling respectively. 
 *
 * Topic builders are retrieved by calling `{@link #getTopicBuilder}`, which in turn attempts a dynamic import of
 * the module for the topic builder. Topic builder modules are expected to be found in `topics/<topicname>/<topicname>.js`
 * and export a function as described above as default. The function may be `async`.
 */
export default class BriefingBuilder {
	static EVT_BRIEFING_START = 'briefingstart';
	static EVT_BRIEFING_TOPIC = 'briefingtopic';
	// Unprefixed to conform to API standard. See https://nodejs.org/dist/latest-v18.x/docs/api/events.html#error-events
	static EVT_BRIEFING_FINISH = 'briefingfinish';
	
	/**
	 * Creates a new `BriefingBuilder`.
	 * @param  {GameObjectFactory} [gameObjectFactory] A game object factory that will be passed to each
	 * topic builder. It is possible to create a briefing builder without a game object factory, but note 
	 * that topic builders will then also not have one available.
	 */
	constructor(gameObjectFactory) {
		this.gameObjectFactory = gameObjectFactory;
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
		return {
			html: `There was an error while making the topic: ${err}`
		};
	}

	/**
	 * Builds a briefing using the battle and the agenda. This method examines the passed
	 * agenda and optains topic builders for each topic the agenda requests. These topic
	 * builders are then (asynchronously) executed. 
	 *
	 * This method returns an object `{ html, css, topics }` where `html` and `css` contain the
	 * content and styling for the briefing "scaffolding", respectively. The briefing scaffolding
	 * is the briefing with only empty placeholders for each topic to be built. `topics` will
	 * receive the results of the topic builder executions as they become available, but note
	 * that `html` and `css` will not be updated accordingly.
	 *
	 * The returned briefing object is an instance of `EventEmitter`. It emits 
	 * - `BriefingBuilder.EVT_BRIEFING_START` when it has constructed the scaffolding and is beginning to build the topics.
	 * - `BriefingBuilder.EVT_BRIEFING_TOPIC` when a topic builder has finished rendering its topic. This event passes the 
	 * topic's index and the result of the topic builder into attached listeners.
	 * - `BriefingBuilder.EVT_BRIEFING_FINISH` when all topic builders have finished. For convenience, this also passes the
	 * entire briefing into listeners again.
	 *
	 * This method returns synchronously.
	 * @param  {Battle} battle            The battle for which to build the briefing.
	 * @param  {Agenda} agenda            The agenda by which to build the briefing.
	 * @return {Object} An object containing the HTML for the briefing scaffoldd in `html`
	 * and the scoped styling for the briefing in `css`. This object is an event emitter,
	 * as desribed above.
	 */
	build(battle, agenda) {
		// Helper function to infer a caption from a topic name by
		// - replacing all underscores with spaces
		// - capitalizing the first letter of the topic name
		// - capitalizing the first letter after an underscore
		function inferCaption(topicName) {			
			return topicName.split('_')
						.map(substr => substr.charAt(0).toUpperCase() + substr.substring(1))
						.join(' ');
		}

		
		const t0 = Date.now();
		const dedicatedlog = rootlog.getLogger(this.constructor.name);

		const briefing = new EventEmitter();
		briefing.topics = new Array(agenda.getTopicNames().length);
		briefing.html = renderBriefing(briefing);
		briefing.css = sass.compile('src/briefing/briefing.scss');
		
		// Defer emission so there is a chance to attach event listeners
		setImmediate(() => briefing.emit(BriefingBuilder.EVT_BRIEFING_START));

		// Do NOT return or await this Promise, because we need to return briefing synchronously.
		// The async nature of the building process is reflected through event emissions.
		Promise.allSettled(agenda.getTopicNames().map(async (topicName, index) => {
			rootlog.debug(`Building topic ${topicName}`);

			let topic;

			try {
				const dynimport = await this.getTopicBuilder(topicName);
				topic = await dynimport.default(
					// Pass a separate copy of the battle to each topic builder
					clone(battle), 
					this.gameObjectFactory, 
					agenda.topics[topicName]);

				const caption = topic.caption ?? inferCaption(topicName)
				topic = {
					html: renderTopic({ index, caption, html: topic.html }),
					css: sass.compileString(`#topic-${index} { ${topic.css ?? ''} }`).css
				}
				briefing.topics[index] = topic;
				dedicatedlog.debug(`Built topic ${topicName} in ${Date.now() - t0}ms`);
			} catch (err) {
				rootlog.error(`Building topic ${topicName} failed: ${err}`);
				return this.buildErrorTopic(err)				
			}			
			briefing.emit(BriefingBuilder.EVT_BRIEFING_TOPIC, index, topic);
			return topic;
		})).then(() => {
			briefing.emit(BriefingBuilder.EVT_BRIEFING_FINISH, briefing);
		});

		return briefing;
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