// We can't use template literals (`${foo}`) for label lookup, because their interpolation cannot be deferred,
// and at declaration time there is no context to allow their interpolation.
// So we use a templating engine (pupa) here, and interpolate at runtime.
// The template strings we use are therefore regular strings, and there is no $ in front of the expressions to be interpolated.
import template from 'pupa';
import { screamingSnakeCase } from '../util/util.js';

/**
 * Labels a consumable by attaching labels to all flavors of the consumable. Consumable flavors can optionally have a different label from the default,
 * e.g. Crawling Smoke Generators are still a Smoke Generator consumable, but need to be labeled differently. This labeling function takes care of that.
 *
 * Falls back to the consumable type if no label could be found.
 */
function labelConsumable(data) {
	let flavors = Object.values(data).filter(obj => typeof obj === 'object' && obj !== null && 'consumableType' in obj);
	for (let flavor of flavors) {
		let templateData = {
			...flavor,
			index: data.index
		}
		let key = flavor.titleIDs ? labelConsumable.LABEL_KEYS.flavored : labelConsumable.LABEL_KEYS.default;
		key = template(key, templateData).toUpperCase();
		flavor.label = this.labels?.[key] ?? flavor.consumableType;
	}
	return data;
}
// See note above
labelConsumable.LABEL_KEYS = {
	flavored: 'IDS_DOCK_CONSUME_{titleIDs}',
	default: 'IDS_DOCK_CONSUME_{index}_{consumableType}'
}

function labelCaptain(data) {
	let skillNames = Object.keys(data.Skills);
	for (let skillName of skillNames) {
		let skill = data.Skills[skillName];
		let key = template(labelCaptain.LABEL_KEYS.normalSkill, { skillName: screamingSnakeCase(skillName) });
		skill.label = this.labels?.[key] ?? skillName;
	}
	return data;
}
labelCaptain.LABEL_KEYS = {
	normalSkill: 'IDS_SKILL_{skillName}',
	uniqueSkill: 'IDS_TALENT_{index}_{triggerType}_{????????}' // @todo Find out how unique skill labels are determined. Wargaming seems to have gone completely bonkers here, at first glance there is no rhyme or reason to it.
}

/**
 * The default labeling method. Attaches a label to `data` based on `data`'s `typeinfo.type`.
 *
 * Falls back to `data.name` if no label could be found.
 */
function labelDefault(data) {
	let key = labelDefault.LABEL_KEYS[data?.typeinfo?.type];
	if (key)
		key = template(key, data).toUpperCase();
	data.label = this.labels?.[key] ?? data.name;

	return data;
}
// See note above
labelDefault.LABEL_KEYS = {
	'Ship': 'IDS_{index}',
	'Modernization': 'IDS_TITLE_{name}',
	'Crew': 'IDS_{CrewPersonality.personName}',
	'Projectile': 'IDS_{name}',
	'Gun': 'IDS_{name}'
}

class Labeler {
	constructor(labels) {
		this.labels = labels;
	}

	/**
	 * Which labeling function to use for a given `typeinfo.type`.
	 */
	static LABELERS = {
		'Ability': labelConsumable,
		'Captain': labelCaptain
	}
	/**
	 * The default labeling function to use.
	 */
	static DEFAULT_LABELER = labelDefault;

	/** 
	 * Attaches a human-readable label to the provided `data` object using the labeling function 
	 * as per `data.typeinfo.type`. 
	 * @param {*} data The `data` to attach the label to.
	 * @returns {Object} Returns `data`, with a label attached under `label`.
	 */
	label(data) {
		let labeler = Labeler.LABELERS[data?.typeinfo?.type] ?? Labeler.DEFAULT_LABELER;
		return labeler.call(this, data);
	}

}

export default Labeler;