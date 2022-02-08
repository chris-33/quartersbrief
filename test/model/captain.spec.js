import { Captain } from '../../src/model/captain.js';
import { Ship } from '../../src/model/ship.js';
import { Modifier } from '../../src/util/modifier.js';
import { readFileSync } from 'fs';
import clone from 'just-clone';

describe('Captain', function() {
	let ship;
	let captain;
	let classSkills;
	let knownTargets;
	let TEST_DATA;

	before(function() {
		ship = new Ship(JSON.parse(readFileSync('test/model/testdata/ship.json')));		
		TEST_DATA = JSON.parse(readFileSync('test/model/testdata/captain.json'));

		classSkills = Captain.CLASS_SKILLS;
		Captain.CLASS_SKILLS = { 
			Battleship: [1,2],
			Cruiser: [2,3]
		}
		knownTargets = Modifier.KNOWN_TARGETS;
		Modifier.KNOWN_TARGETS = { EngineValue: 'engine.value', ArtilleryValue : 'artillery.value' };
	});

	after(function() {
		Captain.CLASS_SKILLS = classSkills;
		Modifier.KNOWN_TARGETS = knownTargets;
	});

	beforeEach(function() {
		captain = new Captain(clone(TEST_DATA));
	});

	describe('.getLearnableForShip', function() {
		it('should return only skills that are in the skill list for the ship\'s species', function() {
			expect(captain.getLearnableForShip(ship)).to
				.be.an('array')
				.with.deep.members([captain.get('Skills.BattleshipSkill1'), captain.get('Skills.BattleshipSkill2')]);	
		});		
	});

	describe('.learn', function() {
		it('should learn a skill that is provided as an object', function() {
			let skill = captain.qb_skills[0];
			captain.learn(skill);
			expect(captain.qb_skills).to.include(skill);
		});

		it('should learn a skill that is provided by number', function() {
			let skill = 1;
			captain.learn(skill);
			skill = captain.qb_skills.find(s => s.getSkillnumber() === skill);
			expect(captain.qb_learned).to.include(skill);
		});

		it('should not learn the same skill more than once', function() {
			let skill = captain.qb_skills[0];
			expect(captain.qb_learned).to.be.empty;
			captain.learn(skill);
			expect(captain.qb_learned).to.have.lengthOf(1);
			captain.learn(skill); // Learn the same skill again
			expect(captain.qb_learned).to.have.lengthOf(1);
		});

		it('should learn all skills when passed an array of skills or numbers', function() {
			let s1 = captain.qb_skills[0];
			let s2 = captain.qb_skills[1];
			expect(captain.qb_learned).to.be.empty;
			captain.learn([s1, s2.getSkillnumber()]);
			expect(captain.qb_learned).to.be.an('array').with.deep.members([s1, s2]);
		});
	});

	describe('.getLearnedForShip', function() {
		it('should not return skills that have not been learned', function() {
			expect(captain.getLearnedForShip(ship)).to.be.empty;
			captain.learn(TEST_DATA.Skills.BattleshipSkill1.skillType);
			expect(captain.getLearnedForShip(ship)).to.be.an('array').with.lengthOf(1);
			captain.learn(TEST_DATA.Skills.BattleshipSkill2.skillType);
			expect(captain.getLearnedForShip(ship)).to.be.an('array').with.lengthOf(2);
		});

		it('should return a skill that has been learned before', function() {
			let skill = new Captain.Skill(captain.get('Skills.BattleshipSkill1'));
			captain.learn(skill);
			expect(captain.getLearnedForShip(ship)).to.deep.include(skill);
		});

		it('should not return any skills that do not match the ship\'s type', function() {
			captain.qb_learned = captain.qb_skills; // Learn all skills
			let learned = captain.getLearnedForShip(ship);
			expect(learned).to.be.an('array');
			learned.forEach(skill => expect(skill.eligible(ship)).to.be.true);
		});
	});

	describe('Captain.Skill', function() {
		describe('.eligible', function() {
			it('should be true for skills that match the ship and false otherwise', function() {
				let skill = new Captain.Skill(captain.get('Skills.BattleshipSkill1'));
				expect(skill.eligible(ship), 'matching ship').to.be.true;
				skill = new Captain.Skill(captain.get('Skills.CruiserSkill'));
				expect(skill.eligible(ship), 'non-matching ship').to.be.false;
			});
		});

		describe('.getModifiers', function() {
			it('should return modifier objects only for those modifiers where it is known how to deal with them', function() {
				let skill = new Captain.Skill(captain.get('Skills.BattleshipSkill1'));
				expect(skill.getModifiers()).to
					.be.an('array')
					.with.lengthOf(1);
			});
		});
	});

});

