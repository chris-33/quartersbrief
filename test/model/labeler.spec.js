import Labeler from '../../src/model/labeler.js';
import clone from 'clone';
import sinon from 'sinon';

describe('Labeler', function() {
	const TEST_DATA = {
		LABEL_CONSTANT: 'constant label',
		LABEL_INTERPOLATED: 'interpolated label',
		IDS_DOCK_CONSUME_TITLE_PCY001_WITHTITLEID: 'title ID',
		IDS_DOCK_CONSUME_TITLE_PCY001_CONSUMABLE: 'consumable type',
		IDS_SKILL_NORMAL_SKILL_A: 'skill A',
		IDS_SKILL_NORMAL_SKILL_B: 'skill B',
	}

	let labeler;

	beforeEach(function() {
		labeler = new Labeler(clone(TEST_DATA));
	});

	describe('.label', function() {
		it('should choose the correct labeling function based on typeinfo.type', function() {
			let labelers = Labeler.LABELERS;
			let defaultLabeler = Labeler.DEFAULT_LABELER;
			Labeler.LABELERS = {
				'Type1': sinon.stub(),
				'Type2': sinon.stub()
			}
			Labeler.DEFAULT_LABELER = sinon.stub();
			try {
				let data = {
					typeinfo: { type: 'Type1' }
				}
				labeler.label(data);
				expect(Labeler.LABELERS.Type1).to.have.been.calledOnce;

				data = {
					typeinfo: { type: 'Type2' }
				}
				labeler.label(data);
				expect(Labeler.LABELERS.Type2).to.have.been.calledOnce;

				data = {
					typeinfo: { type: 'DefaultType' }
				}
				labeler.label(data);
				expect(Labeler.DEFAULT_LABELER).to.have.been.calledOnce;
			} finally {
				Labeler.LABELERS = labelers;
				Labeler.DEFAULT_LABELER = defaultLabeler;
			}
		});
	});

	describe('Labeler.DEFAULT_LABELER', function() {
		let defaultLabelerLabelKeys;
		
		before(function() {
			defaultLabelerLabelKeys = Labeler.DEFAULT_LABELER.LABEL_KEYS;
			Labeler.DEFAULT_LABELER.LABEL_KEYS = {
				'Constant': 'LABEL_CONSTANT',
				'Interpolated': 'LABEL_{typeinfo.type}'
			}
		});

		after(function() {
			Labeler.DEFAULT_LABELER.LABEL_KEYS = defaultLabelerLabelKeys;
		});

		it('should attach a human-readable label by simple lookup', function() {
			let data = {
				typeinfo: { type: 'Constant' }
			}
			expect(Labeler.DEFAULT_LABELER.call(labeler, data)).to.have.property('label').that.equals(TEST_DATA.LABEL_CONSTANT);
		});

		it('should attach a human-readable label by interpolated lookup', function() {
			let data = {
				typeinfo: { type: 'Interpolated' }
			}
			expect(Labeler.DEFAULT_LABELER.call(labeler, data)).to.have.property('label').that.equals(TEST_DATA.LABEL_INTERPOLATED);
		});

		it('should fall back to the object\'s name property if no label is found', function() {
			let data = {
				name: 'Unknown',
				typeinfo: { type: 'Unknown'}
			}
			expect(Labeler.DEFAULT_LABELER.call(labeler, data)).to.have.property('label').that.equals(data.name);
		});
	});

	describe('Labeler.LABELERS.Ability', function() {
		const CONSUMABLE_DATA = {
			WithTitleID: {
				titleIDs: 'PCY001_WITHTITLEID',
				consumableType: 'Type1'
			},
			WithoutTitleID: {
				titleIDs: '',
				consumableType: 'Type1'
			},
			name: 'PCY001_Consumable',
			typeinfo: {
				type: 'Ability'
			}
		}

		let data;

		beforeEach(function() {
			data = clone(CONSUMABLE_DATA);
		});

		it('should attach a label to each flavor but not to the consumable itself', function() {
			data = Labeler.LABELERS.Ability.call(labeler, data);
			expect(data.WithTitleID).to.have.property('label');
			expect(data.WithoutTitleID).to.have.property('label');
			expect(data).to.not.have.property('label');
		});

		it('should attach the label based on the flavor\'s title id if present', function() {
			data = Labeler.LABELERS.Ability.call(labeler, data);
			expect(data.WithTitleID.label).to.equal(TEST_DATA.IDS_DOCK_CONSUME_TITLE_PCY001_WITHTITLEID);
		});

		it('should attach the label based on consumable type if no title id is present', function() {
			data = Labeler.LABELERS.Ability.call(labeler, data);
			expect(data.WithoutTitleID.label).to.equal(TEST_DATA.IDS_DOCK_CONSUME_TITLE_PCY001_CONSUMABLE);
		});

		it('should fall back to the consumableType if no label is found', function() {
			data = {
				UnknownFlavor: {
					titleIDs: '',
					consumableType: 'UnknownType'					
				},
				name: 'PCY002_OtherConsumable',
				typeinfo: { type: 'Ability' }
			}
			data = Labeler.LABELERS.Ability.call(labeler, data);
			expect(data.UnknownFlavor).to.have.property('label').that.equals(data.UnknownFlavor.consumableType);
		});
	});

	describe('Labeler.LABELERS.Captain', function() {
		const CAPTAIN_DATA = {
			Skills: {
				NormalSkillA: {},
				NormalSkillB: {},
			},
			typeinfo: {
				type: 'Crew'
			}
		}

		let data;
		beforeEach(function() {
			data = clone(CAPTAIN_DATA);
		});

		it('should attach a label to each skill based on the skill\'s name', function() {
			data = Labeler.LABELERS.Captain.call(labeler, data);
			expect(data.Skills.NormalSkillA).to.have.property('label').that.equals(TEST_DATA.IDS_SKILL_NORMAL_SKILL_A);
			expect(data.Skills.NormalSkillB).to.have.property('label').that.equals(TEST_DATA.IDS_SKILL_NORMAL_SKILL_B);
		});

		it('should fall back to the key of the skill object if no label is found', function() {
			data = {
				Skills: {
					UnknownSkill: {}
				},
				typeinfo: {
					type: 'Crew'
				}
			}
			data = Labeler.LABELERS.Captain.call(labeler, data);
			expect(data.Skills.UnknownSkill).to.have.property('label').that.equals('UnknownSkill');
		});
	});
});