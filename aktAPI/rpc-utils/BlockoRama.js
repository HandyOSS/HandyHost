const fs = require('fs');
const http = require('http');
const redis = require('redis');

class BlockoRama{
	constructor(){
		this.restBase = 'http://127.0.0.1:1317/';
		this.redisHeight = 0;
		this.chainHeight = 0;
		this.types = {};
		this.redis = redis.createClient();
		this.redis.connect();
		
		this.res = {};
		this.uniqueTypes = {};
		this.openLeases = {};
		this.eventTargets = {
		  //'deployment/create-deployment':true,
		  'deployment/close-deployment':true,
		  'market/create-bid':true,
		  'market/close-bid':true,
		  'market/create-lease':true,
		  'market/close-lease':true
		}
		//this.checkHeight();
	}
	checkHeight(){
		return new Promise((resolve,reject)=>{
			this.getCurrentHeight().then(chainHeight=>{
				this.chainHeight = chainHeight;
				this.redis.get('latestheight').then(latestheight=>{
					let redisHeight = 0;
					if(latestheight != null){
						redisHeight = parseInt(latestheight);
					}
					this.redisHeight = redisHeight;
					//console.log('redis height',redisHeight);
					//console.log('chain height',chainHeight);
					if(this.redisHeight < this.chainHeight){
						this.doGroup(this.redisHeight,resolve);
					}
					else{
						resolve({chain:this.chainHeight,redis:this.redisHeight});
					}
				})
			})
		})
		
	}
	getCurrentHeight(){
		return new Promise((resolve,reject)=>{
			let output = '';
			const request = http.request(this.restBase+'blocks/latest',response=>{
				response.on('data',chunk=>{
					output += chunk;
				})
				response.on('end',() =>{
					let json = {};
					let height = 0;
					try{
						json = JSON.parse(output);
					}
					catch(e){
						console.log('no json response');
					}
					if(typeof json.block != "undefined"){
						height = parseInt(json.block.header.height);
					}
					resolve(height);
				})
			});
			request.end();
		})
	}
	harvest(height){
		return new Promise((resolve,reject)=>{
			let output = '';
			const request = http.request(this.restBase+'txs?tx.height='+height,response=>{
				//another chunk of data has been received, so append it to `str`
				
				response.on('data', (chunk) => {
					output += chunk;
				});

				//the whole response has been received, so we just print it out here
				response.on('end', () => {
					let json = {};
					try{
						json = JSON.parse(output);
					}
					catch(e){
						console.log('no json response');
					}
					//console.log('done with',height);
					//if(height+1 < this.chainHeight){
						/*if(height % 100 == 0){
							console.log('done with',height);
						}*/
						//this.harvest(height+1);
						//console.log('resolve json',height,json);
						resolve({height,json});
					//}

				});
			});
			request.end();
		})
		
		
	}
	doGroup(height,resolveWhenSynced){
		let doneCount = 0;
		this.res = {};
		const nextHeight = height+1000 > this.chainHeight ? this.chainHeight : height + 1000;
		const blockDiff = (nextHeight - height);
		if(height == this.chainHeight){
			//console.log('FULLY SYNCED AT BLOCK',this.chainHeight);
			this.redisHeight = height;
			resolveWhenSynced({redis:this.redisHeight,chain:this.chainHeight});
		}
		for(let i=height;i<nextHeight;i++){
			this.harvest(i).then((obj)=>{
				//console.log('data',obj.json,obj.height);
				this.res[obj.height] = obj.json;
				doneCount += 1;
				//console.log('donecount',doneCount);
				if(doneCount == blockDiff){
					console.log('done with redis sync, next group',nextHeight);
					Object.keys(this.res).map(h=>{
						//console.log('this.res.h',h,this.res[h])
						if(typeof this.res[h] == "undefined"){
							return;
						}
						this.redis.set('latestheight',h);
						if(typeof this.res[h].txs != "undefined"){
							this.res[h].txs.map(tx=>{
								
								if(tx.codespace == 'sdk' && tx.code == 11){
									//fees failure
									return;
								}
								tx.tx.value.msg.map((msg,i)=>{
									let type = msg.type;
									//this.types[type] = true;
									this.uniqueTypes[type] = true;
									//console.log('types',type);
									if(this.eventTargets[type]){
										
										this.addToRedis(msg,i,type);

									}
									/*if(JSON.stringify(msg).indexOf('akash1wfhp0lgtvcfn4xxfmyd7kekv68zwtp72kstql7') >= 0 && JSON.stringify(msg).indexOf('3130888') >= 0){
										console.log('!!!!!!!!!message from string',JSON.stringify(msg));
										//console.log('ALL TXES',h,JSON.stringify(this.res[h],null,2))
									}*/
									/*else{
										if(JSON.stringify(msg).indexOf('akash19c9avvw2cfvwe2lz7e4cfzv5f7c7hpqxsrkjgr') >= 0 && JSON.stringify(msg).indexOf('3123181') >= 0){
											console.log('!!!!!!!!!mesage from string',JSON.stringify(msg));
										}
									}*/
								})
								

							})
							
						}
					})
					delete this.res;
					//console.log('unique types',Object.keys(this.uniqueTypes));
					this.doGroup(nextHeight,resolveWhenSynced);
				}
			})
		}
	}
	getIDsFromTXPayload(msg){
		let provider,owner,dseq,oseq,gseq,orderID;
		if(typeof msg.value.order == "undefined"){
			//must be in id
			provider = msg.value.id.provider;
			owner = msg.value.id.owner;
			dseq = msg.value.id.dseq;
			gseq = msg.value.id.gseq;
			oseq = msg.value.id.oseq;
		}
		else{
			provider = msg.value.provider;
			owner = msg.value.order.owner;
			dseq = msg.value.order.dseq;
			gseq = msg.value.order.gseq;
			oseq = msg.value.order.oseq;
		}


		orderID = `${owner}/${dseq}`///${gseq}/${oseq}
		return {orderID,provider}
	}
	addToRedis(msg,i,type){
		
		const {orderID,provider} = this.getIDsFromTXPayload(msg);
		if(type != 'deployment/close-deployment' && type != 'market/close-lease' && typeof provider != "undefined"){
			//let zAddval = 1;
			this.redis.zAdd(orderID,{score:1,value:provider},(err,result)=>{

			});
		}
		if(type == 'market/create-lease'){
			this.redis.set('lease_'+orderID,provider);
			//this.openLeases[orderID] = provider;
		}
		
		if(type == 'market/create-bid'){

			this.redis.zAdd(provider,{score:1,value:orderID},(err,res)=>{});
		}
		else{
			let val;
			this.redis.get('lease_'+orderID).then(leaseProvider=>{
			//const leaseProvider = this.openLeases[orderID];
				if(leaseProvider != null){
					
					if(type == 'market/create-lease'){
					//ok set everybody != the provider to lost status
						this.redis.zRange(orderID,'0','-1','WITHSCORES').then((rangeResponse)=>{
							rangeResponse.map(providerID=>{
								if(providerID != leaseProvider){
									val = 2; //lost
								}
								else{
									val = 3; //active lease
								}
								this.redis.zAdd(providerID,{score:val,value:orderID},(err,res)=>{});
							});
						});
					}
					if(type == 'market/close-lease' || type == 'deployment/close-deployment'){
						//score=4 is closed lease that provider won
						
						this.redis.zRange(orderID,'0','-1','WITHSCORES').then((rangeResponse)=>{
							rangeResponse.map(providerID=>{
								if(providerID != leaseProvider){
									val = 2; //lost
								}
								else{
									val = 4; //active lease
								}
								this.redis.zAdd(providerID,{score:val,value:orderID},(err,res)=>{});
							});
						});
						//this.redis.zAdd(d,{score:4,value:orderID},(err,res)=>{});
					}
				}
				else{
					//we just closed a bid before lease was created
					if(type == 'market/close-bid'){
						this.redis.zAdd(provider,{score:0,value:orderID},(err,res)=>{});
					}
					if(type == 'deployment/close-deployment'){
						this.redis.zRange(orderID,'0','-1','WITHSCORES').then((rangeResponse)=>{
							rangeResponse.map(providerID=>{
								this.redis.zAdd(providerID,{score:0,value:orderID},(err,res)=>{});
							});
							//cleanup
							//delete this.openLeases[orderID];
							//this.redis.del(orderID);
							//this.redis.del('lease_'+orderID);

						});
					}
				}
			})
		}
		
	}
	
}
module.exports = BlockoRama;