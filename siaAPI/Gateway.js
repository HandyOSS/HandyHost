import {siacCommand, siacPostDataCommand} from './helper.js';

export class Gateway{
	constructor(){

	}
	addSeeds(){
		//add seed nodes from: https://siastats.info/nodes
		return new Promise((resolve,reject)=>{
			const seeds = [
				'210.245.14.208:9981',
				'176.226.158.223:9981',
				'81.196.138.172:11152',
				'47.56.69.161:9981',
				'92.14.105.40:9981'
			];
			let seedsAdded = 0;
			seeds.map(seedAddress=>{
				siacCommand(`gateway/connect/${seedAddress}`,'POST').then(d=>{
					console.log('added seed peer',d);
					seedsAdded += 1;
					if(seedsAdded == seeds.length){
						resolve();
					}
				}).catch(e=>{
					console.error('ERROR ADDING SEED PEER INFO',e);
					seedsAdded += 1;
					if(seedsAdded == seeds.length){
						resolve();
					}
				});
			});
		})
	}
	getBandwidth(){
		siacCommand(`gateway/bandwidth`,'GET').then(d=>{
			console.log('gateway bandwidth',d);
			
		}).catch(e=>{
			console.error('ERROR GETTING BANDWIDTH INFO',e);
			
		});
	}
}