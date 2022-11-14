import GameObject from './gameobject.js';
import { conversions } from '../util/conversions.js';

export default class Torpedo extends GameObject {
	getRange() { return conversions.BWToMeters(this.get('maxDist')); }
	getDamage() { return this.get('alphaDamage') / 3 + this.get('damage'); }
	getSpeed() { return this.get('speed'); }	
	isDeepWater() { return this.get('isDeepWater'); }
	getFloodChance() { return this.get('uwCritical') * 100; }
	getVisibility() { return this.get('visibilityFactor'); }
}