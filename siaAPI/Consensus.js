import {siacCommand, siacPostDataCommand} from './helper.js';

export class Consensus{
	constructor(){

	}
	getChainStatus(){
		return siacCommand('consensus','GET');
	}
}