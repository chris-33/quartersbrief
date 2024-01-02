import { expose } from './dataobject.js';
import GameObject from './gameobject.js';

/**
 * This class models a ship ability - called "consumable" in game.
 * 
 * @see Ability.gamedata
 */
export default class Consumable extends GameObject {
	isType(type) {
		return this.get('consumableType') === type;
	}
}
expose(Consumable, {
	'consumableType': 'consumableType',
	'distShip': 'distShip',
	'workTime': 'workTime',
	'reloadTime': 'reloadTime',
	'numConsumables': 'numConsumables',
	'torpedoReloadTime': 'torpedoReloadTime' // Torpedo Reload Booster
});