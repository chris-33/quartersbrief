import * as compiler from '../../src/agendas/compiler.js';
import Agenda from '../../src/agendas/agenda.js';
import TOML from '@iarna/toml';
import YAML from 'yaml';
import mockfs from 'mock-fs';
import clone from 'clone'; 

describe('Agenda compilation functions', function() {
	after(function() {
		mockfs.restore();
	});
	
	describe('load', function() {
		const agendasdir = 'agendas';
		it('should ignore files whose extension is not .yaml, .yml, .json or .toml', function() {
			mockfs({ [agendasdir]: {
				'somethingelse.txt': ''
			}});

			return expect(compiler.load(agendasdir)).to.eventually.be.empty;
		});
		
		it('should be able to parse TOML, YAML and JSON', async function() {
			const expected = {
				prop: 'value'
			};
			const files = {
				'agenda.yaml': YAML.stringify(expected),
				'agenda.yml': YAML.stringify(expected),
				'agenda.toml': TOML.stringify(expected),
				'agenda.json': JSON.stringify(expected)
			};
			for (let file in files) {
				mockfs({
					[agendasdir]: {
						[file]: files[file]
					}
				});

				try {
					const result = await compiler.load(agendasdir);
					expect(result).to.have.deep.members([ expected ]);
				} finally {
					mockfs.restore();
				}
			}
		});

		it('should throw if the agendas path does not exist', function() {
			return expect(compiler.load('doesnotexist')).to.eventually.be.rejected;
		});

		it('should return an empty array if there are no agenda files', function() {
			mockfs({ [agendasdir]: {} });
			return expect(compiler.load(agendasdir)).to.eventually.be.an('array').that.is.empty;
		});

		it('should retrieve all agendas', function() {
			const number = 4;
			const files = Object.fromEntries(new Array(number)
					.fill({})
					.map(JSON.stringify)
					.map((agenda, index) => [ `agenda${index}.json`, agenda ]));

			mockfs({ [agendasdir] : files });
			return expect(compiler.load(agendasdir)).to.eventually
				.be.an('array').with.lengthOf(number);
		});		
	});

	describe('link', function() {
		it('should throw if the extended agenda does not exist', function() {
			const agenda = {
				extends: 'doesnotexist'
			}
			expect(compiler.link.bind(null, agenda, [])).to.throw();
		});

		it('should not change an agenda that does not extend', function() {
			const agenda = {};
			expect(compiler.link(agenda)).to.equal(agenda);
		});

		it('should replace the value of the extends property with the agenda', function() {
			const extending = {
				extends: 'extended'
			}
			const extended = {
				name: 'extended'
			}
			const result = compiler.link(extending, [ extended ]);
			expect(result).to.have.property('extends').that.equals(extended);
		});
	});

	describe('extend', function() {
		it('should use the extended agenda\'s matchers if the extending agenda does not have any', function() {
			const extending = new Agenda();
			const extended = new Agenda({ tiers: [ 8 ] });

			const result = compiler.extend(extending, extended);

			expect(result.matchers).to.deep.equal(extended.matchers);
		});

		it('should use the extending agenda\'s matchers if defined', function() {
			const extending = new Agenda({ tiers: [ 8 ] });
			const extended = new Agenda({ classes: [ 'Destroyer' ] });
			
			const result = compiler.extend(extending, extended);

			expect(result.matchers).to.deep.equal(extending.matchers);
		});

		it('should add topics from the extended agenda if not present in the extending agenda', function() {
			const topic = { prop: 'val' };
			const extending = new Agenda();
			const extended = new Agenda({}, { topic });

			const result = compiler.extend(extending, extended);

			expect(result.topics).to.have.property('topic').that.deep.equals(topic);
		});

		it('should keep topics from the extending agenda even if not present in the extended agenda', function() {
			const topic = { prop: 'val' };
			const extending = new Agenda({}, { topic });
			const extended = new Agenda();

			const result = compiler.extend(extending, extended);

			expect(result.topics).to.have.property('topic').that.deep.equals(topic);
		});

		it('should add topic properties from the extended agenda', function() {
			const extending = new Agenda(null, { 
				topic: { prop1: 'val1' } 
			});
			const extended = new Agenda(null, { 
				topic: { prop2: 'val2' } 
			});

			const result = compiler.extend(extending, extended);

			expect(result.topics).to.have.property('topic');
			expect(result.topics.topic).to.have.property('prop1').that.equals('val1');
			expect(result.topics.topic).to.have.property('prop2').that.equals('val2');
		});

		it('should not overwrite topic properties already defined by the extending agenda', function() {
			const extending = new Agenda(null, {
				topic: { prop: 'val1' } 
			});
			const extended = new Agenda(null, { 				
				topic: { prop: 'val2' } 
			});

			const result = compiler.extend(extending, extended);

			expect(result.topics).to.have.property('topic');
			expect(result.topics.topic).to.have.property('prop').that.equals('val1');			
		});	

		it('should preserve the order of topics of the extended agenda', function() {
			const extending = new Agenda(null, {
				topic1: {},
				topic2: {}
			});
			const extended = new Agenda(null, {
				topic2: {},
				topic1: {}
			});

			expect(Object.keys(extending.topics)).to.have.ordered.members([ 'topic1', 'topic2' ]);
			expect(Object.keys(extended.topics)).to.have.ordered.members([ 'topic2', 'topic1' ]);

			const result = compiler.extend(extending, extended);
			expect(Object.keys(result.topics)).to.have.ordered.members(Object.keys(extended.topics))
		});

		it('should prepend topics from the extending agenda that are not present in the extended agenda', function() {
			const extending = new Agenda(null, {
				topic3: {},
			});
			const extended = new Agenda(null, {
				topic1: {},
				topic2: {}
			});

			const result = compiler.extend(extending, extended);
			expect(Object.keys(result.topics)).to.have.ordered.members([ 'topic3', 'topic1', 'topic2' ]);
		});
	});

	describe('compile', function() {
		it('should throw if the agenda\'s extension chain is circular', function() {
			let agendas = [];
			for (let i = 0; i < 3; i++) {
				agendas.push({
					name: `agenda${i}`,
					extends: i
				});
			}
			agendas.forEach(agenda => agenda.extends = agendas[agenda.extends]);
			expect(compiler.compile.bind(null, agendas[0])).to.throw(/circular/i);
		});

		it('should extend the extending agenda with the extended agenda', function() {
			const extended = {
				topics: {
					topic: {}
				}
			};
			const extending = {
				extends: extended
			};
			const expected = compiler.extend(clone(extending), clone(extended));
			delete expected.extends;

			const result = compiler.compile(extending);

			expect(result).to.deep.equal(Agenda.from(expected));
		});

		it('should compile the extended agenda', function() {
			const grandparent = {
				topics: {
					topic1: {}
				}
			};
			const parent = {
				extends: grandparent,
				topics: {
					topic2: {}
				}
			}
			const child = {
				extends: {
					extends: parent
				}
			};

			const result = compiler.compile(child);

			expect(result).to.have.property('topics').that.deep.equals({
				...grandparent.topics,
				...parent.topics
			});
		});

		it('should return an agenda from the unchanged raw data if it does not extend', function() {
			const matcher = {
				cond: 'value'
			}
			const topic = {
				prop: 'value'
			}
			const agenda = {
				name: 'name',
				matches: [ matcher ],
				topics: { topic }
			}

			const result = compiler.compile(clone(agenda)); // clone so we can compare to the original

			expect(result).to.deep.equal(Agenda.from(agenda));
		});

		it('should remove the extends property', function() {
			const agenda = {
				extends: {}
			};

			const result = compiler.compile(agenda);
			expect(result).to.not.have.property('extends');
		});

		it('should return an Agenda', function() {
			const agenda = {};

			const result = compiler.compile(agenda);
			expect(result).to.be.an.instanceof(Agenda);
		});
	});
});