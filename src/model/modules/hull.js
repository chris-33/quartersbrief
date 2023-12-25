import Module from '../module.js';
import { expose } from '../dataobject.js';

export default class Hull extends Module {}
expose(Hull, {
	'health': 'health',
	'concealment': 'visibilityFactor'
});