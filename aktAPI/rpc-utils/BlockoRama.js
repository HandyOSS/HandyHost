const fs = require('fs');
const http = require('http');
const redis = require('redis');
const redisCleanup = require(__dirname+'/CleanupRedis.js');

class BlockoRama{
	/*
	🥳🥳🥳 Block o Rama is a block party 🥳🥳🥳
	
	We go thru all blocks in the chain 1k at a time and ingest any applicable types to redis. We check every 60s for new blocks => push to redis
	
	Ultimately this replaces the often faulty RPC calls for:
	akash query market lease list --limit 1 --output json --provider $wallet --count-total --state active
	akash query market lease list --limit 1 --output json --provider $wallet --count-total --state open
	akash query market lease list --limit 1 --output json --provider $wallet --count-total --state closed
	akash query market lease list --limit 1 --output json --provider $wallet --count-total --state lost

	These aggregate queries, when called on-chain:
	1. Eat up 2 CPU's to run per API call
	2. Get queued on the rpc node
	3. (default) timeouts at 10s, but also when 2 users hit an RPC node and queue up 4-5 of these each, all requests timeout
	4. Are called every 90s by anybody running a HandyHost dashboard for akash...

	So what we do in Block o Rama is put all the aggregates into a redis in-memory db for fast lookups.
	This way a provider can get sub-second responses for aggregates thru one endpoint (./redisAggregatesEndpoint.js => getAggregates.lua)

	Conveniently, we have also bundled this into the daemon that runs/keeps akash alive in ./keepAkashAlive.js
	Bonus: We have also build a Dockerfile so we can containerize an RPC node. Now we can deploy RPC nodes on akash
	Double Bonus: Any of those nodes will have this same redis fast aggregates setup stood up in with the RPC node
	Triple Bonus: That riffraff where akash v0.14+ dies syncing on block 969, v0.10.2 dies at block 455200, is automated with our scripts.
	*/

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
						redisCleanup.cleanup();
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
					
					resolve({height,json});
					

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
				this.res[obj.height] = obj.json;
				doneCount += 1;
				if(doneCount == blockDiff){
					console.log('done with redis sync, next group',nextHeight);
					Object.keys(this.res).map(h=>{
						if(typeof this.res[h] == "undefined"){
							return;
						}
						this.redis.set('latestheight',h);
						if(typeof this.res[h].txs != "undefined"){
							this.res[h].txs.map(tx=>{
								
								if(tx.codespace == 'sdk' && tx.code != 32/* && tx.code == 11*/){
									//32 == "account sequence mismatch, expected 1218, got 1223: incorrect account sequence"
									//and thus 32 will go thru.
									//fees, funds or other failure
									
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
								})
								

							})
							
						}
					})
					delete this.res;
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
			//make sure redis knows this is a lease
		}
		
		if(type == 'market/create-bid'){
			//create a bid in our sorted set for this provider's activity
			this.redis.zAdd(provider,{score:1,value:orderID},(err,res)=>{});
		}
		else{
			let val;
			this.redis.get('lease_'+orderID).then(leaseProvider=>{
				if(leaseProvider != null){
					if(type == 'market/create-lease'){
					//ok set everybody != the provider to lost status
					//its likely redundant-ish with a close-bid but also we only get a close-bid event for everybody, not a lost.
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
							this.redis.zAdd('toRemove',{value:orderID,score:1}); //mark for cleanup

						});
					}
				}
			})
		}
		
	}
	
}
module.exports = BlockoRama;