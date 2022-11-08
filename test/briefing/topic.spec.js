import { readFileSync } from 'fs';
import { Battle } from '../../src/model/battle.js';
import esmock from 'esmock';
import sinon from 'sinon';
import clone from 'clone';
import { toSass } from 'sass-cast';
import path from 'path';

describe('Topic', function() {
	let BATTLE_DATA;
	let battle;

	let filters;
	let Topic;
	let topic;

	let pug;
	let sass;

	before(function() {
		BATTLE_DATA = JSON.parse(readFileSync('test/model/testdata/battle.json'));
	});

	beforeEach(function() {
		battle = new Battle(clone(BATTLE_DATA));
	});

	beforeEach(function() {
		const teamsStub = sinon.stub().returns(true);
		const classesStub = sinon.stub().returns(true);
		filters = {
			duplicates: sinon.stub().returns(true),
			teams: sinon.stub().returns(teamsStub),
			classes: sinon.stub().returns(classesStub),
			loadScreenSort: sinon.stub().returns(0)
		}

		pug = { renderFile: sinon.stub().returns('') };
		sass = { compile: sinon.stub().returns({ css: '' }) };
	});

	beforeEach(async function() {
		Topic = (await esmock('../../src/briefing/topic.js', {
			'../../src/briefing/topic-filters.js': filters,
			'pug': { default: pug },
			'sass': { default: sass }
		})).default;
	});

	beforeEach(function() {
		topic = new Topic({
			gameObjectFactory: {
				createGameObject: sinon.stub().returnsArg(0)
			}
		});
	});

	describe('constructor', function() {
		const TOPICS_PATH = 'src/briefing/topics/';

		it('should set all data providers on itself', function() {
			const providers = {
				a: {},
				b: {}
			};
			topic = new Topic('', providers);
			for (let key in providers) 
				expect(topic[key]).to.equal(providers[key]);
		});

		it('should set pugFile and scssFile based on the topic name', function() {
			const topicName = 'topic';
			topic = new Topic(topicName);
			expect(topic).to.have.property('pugFile').that.equals(path.join(TOPICS_PATH, topicName, `${topicName}.pug`));
			expect(topic).to.have.property('scssFile').that.equals(path.join(TOPICS_PATH, topicName, `${topicName}.scss`));
		});

		it('should infer the names of the pug and scss files based on the class name if no topic name is given', function() {
			class DerivedClass extends Topic {}
			topic = new DerivedClass();

			const expected = `derived_class`;
			expect(topic).to.have.property('pugFile').that.equals(path.join(TOPICS_PATH, expected, `${expected}.pug`));
			expect(topic).to.have.property('scssFile').that.equals(path.join(TOPICS_PATH, expected, `${expected}.scss`));
		});

		it('should remove suffix "Topic" when inferring pug and scss files', function() {
			class DerivedFromTopic extends Topic {}

			topic = new DerivedFromTopic();

			const expected = `derived_from`;
			expect(topic).to.have.property('pugFile').that.equals(path.join(TOPICS_PATH, expected, `${expected}.pug`));
			expect(topic).to.have.property('scssFile').that.equals(path.join(TOPICS_PATH, expected, `${expected}.scss`));
		});
	});

	describe('.getPugData', function() {
		describe('with GameObjectFactory', function() {
			it('should have applied all filters', async function() {
				const options = {
					filter: {
						teams: [],
						classes: []
					}
				}
				const ids = battle.getVehicles().map(vehicle => vehicle.shipId);
				const ships = battle.getVehicles().map(vehicle => topic.gameObjectFactory.createGameObject(vehicle.shipId));

				await topic.getPugData(battle, options);
				[
					{ filter: filters.duplicates, args: ids, tag: 'duplicates' },
					{ filter: filters.teams(), args: ids, tag: 'teams()' },
					{ filter: filters.classes(), args: ships, tag: 'classes()' },
				].forEach(({ filter, args, tag }) => {
					expect(filter, tag).to.have.been.called;				
					expect(filter.getCalls().flatMap(call => call.args[0]), tag).to.deep.equal(args);
				});
				
				expect(filters.loadScreenSort, 'loadScreenSort').to.have.been.called;
				expect(filters.teams, 'teams').to.have.been.calledWith(sinon.match.any, options.filter.teams);
				expect(filters.classes, 'classes').to.have.been.calledWith(options.filter.classes);
			});

			it('should have properties battle, options, teams, and ships, where ships is an array of Ship instances', async function() {
				const options = {};
				let result = await topic.getPugData(battle, options);
				expect(result).to.have.property('battle', battle);
				expect(result).to.have.property('options', options);

				expect(result).to.have.property('teams').that.deep.equals({
					player: battle.getPlayer().shipId,
					allies: battle.getAllies().map(vehicle => vehicle.shipId).concat([ battle.getPlayer().shipId ]),
					enemies: battle.getEnemies().map(vehicle => vehicle.shipId)
				});

				expect(result).to
					.have.property('ships')
					.that.deep.equals(battle.getVehicles().map(({ shipId }) => topic.gameObjectFactory.createGameObject(shipId)));
			});
		});

		describe('without GameObjectFactory', function() {
			beforeEach(function() {
				topic = new Topic();
			});

			it('should have applied filters "duplicates" and "teams", but not "classes" and "loadScreenSort"', async function() {
				const options = {
					filter: {
						teams: [],
						classes: []
					}
				}
				const ids = battle.getVehicles().map(vehicle => vehicle.shipId);

				await topic.getPugData(battle, options);
				[
					{ filter: filters.duplicates, args: ids, tag: 'duplicates' },
					{ filter: filters.teams(), args: ids, tag: 'teams()' },
				].forEach(({ filter, args, tag }) => {
					expect(filter, tag).to.have.been.called;				
					expect(filter.getCalls().flatMap(call => call.args[0]), tag).to.deep.equal(args);
				});
				
				expect(filters.classes(), 'classes()').to.not.have.been.called;
				expect(filters.loadScreenSort, 'loadScreenSort').to.not.have.been.called;
				expect(filters.teams, 'teams').to.have.been.calledWith(sinon.match.any, options.filter.teams);
			});

			it('should have properties battle, options teams, and ships, where ships is an array of ship id\'s', async function() {
				const options = {};
				let result = await topic.getPugData(battle, options);
				expect(result).to.have.property('battle', battle);
				expect(result).to.have.property('options', options);

				expect(result).to.have.property('teams').that.deep.equals({
					player: battle.getPlayer().shipId,
					allies: battle.getAllies().map(vehicle => vehicle.shipId).concat([ battle.getPlayer().shipId ]),
					enemies: battle.getEnemies().map(vehicle => vehicle.shipId)
				});

				expect(result).to.have.property('ships').that.deep.equals(battle.getVehicles().map(vehicle => vehicle.shipId));
			});
		});
	});

	describe('.getScssData', function() {
		it('should have an "option" function that returns the sass equivalent of any option\'s value', async function() {
			const options = {
				str: 'string',
				num: 1.3,
				true: true,
				false: false,
				arr: [ 1, 'a', false ],
				obj: {					
					nested: 'nested'
				},
				null: null,
				undef: undefined
			}
			// We're doing this in a slightly convoluted way, because sass expects the functions object to
			// include the parameter name.
			// Obviously the parameter name is irrelevant though for making sure the function works correctly.
			// So we're finding a key that STARTS WITH the function name, and are basing all subsequent assertions
			// on that.			
			let data = await topic.getScssData(battle, options);
			let optionFn = Object.keys(data).find(key => key.startsWith('option'));
			expect(optionFn).to.exist;
			optionFn = data[optionFn];

			expect(optionFn).to.be.a('function')
			for (let key in options)
				expect(optionFn([ toSass(key) ])).to.deep.equal(toSass(options[key]));
		});
	});

	describe('.renderHtml', function() {
		const data = {};
		beforeEach(function() {
			sinon.stub(topic, 'getPugData').resolves(data);
		});

		afterEach(function() {
			topic.getPugData.restore();
		});

		it('should call getPugData', async function() {
			const options = {};
			await topic.renderHtml(battle, options);
			expect(topic.getPugData).to.have.been.calledWith(battle, options);			
		});

		it('should call pug\'s render function with topic.pugFile and the data from getPugData', async function() {
			topic.pugFile = 'pugfile';
			await topic.renderHtml();
			expect(pug.renderFile).to.have.been.calledWith(topic.pugFile, data);
		});
	});

	describe('.renderCss', function() {
		const data = {};
		beforeEach(function() {
			sinon.stub(topic, 'getScssData').resolves(data);
		});

		afterEach(function() {
			topic.getScssData.restore();
		});

		it('should call getScssData', async function() {
			const options = {};
			await topic.renderCss(battle, options);
			expect(topic.getScssData).to.have.been.calledWith(battle, options);			
		});

		it('should call sass\'s compile function with topic.scssFile and the data from getScssData', async function() {
			topic.scssFile = 'scssfile';
			await topic.renderCss();
			expect(sass.compile).to.have.been.calledWith(topic.scssFile, sinon.match({ functions: { ...data }}));
		});
	});

	describe('.render', function() {
		beforeEach(function() {
			sinon.stub(topic, 'renderHtml');
			sinon.stub(topic, 'renderCss');
		});

		afterEach(function() {
			topic.renderHtml.restore();
			topic.renderCss.restore();
		});

		it('should include the caption if one was set', async function() {
			topic.caption = 'caption';
			return expect(topic.render(battle)).to.eventually.have.property('caption').that.equals(topic.caption);
		});

		it('should infer the caption from the class name if none was set', async function() {
			class DerivedClass extends Topic {}

			topic = new DerivedClass();
			sinon.stub(topic, 'renderHtml');
			sinon.stub(topic, 'renderCss');

			return expect(topic.render(battle, null)).to.eventually.have.property('caption').that.equals('Derived Class');
		});

		it('should remove the suffix "Topic" when inferring caption from class name', function() {
			class DerivedFromTopic extends Topic {}

			topic = new DerivedFromTopic();
			sinon.stub(topic, 'renderHtml');
			sinon.stub(topic, 'renderCss');

			return expect(topic.render(battle, null)).to.eventually.have.property('caption').that.equals('Derived From');
		});

		it('should call the renderHtml and renderCss', async function() {
			const options = {};
			await topic.render(battle, options);
			expect(topic.renderHtml).to.have.been.calledWith(battle, options);
			expect(topic.renderCss).to.have.been.calledWith(battle, options);
		});
	});
});