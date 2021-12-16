	const fs = require('fs');
	const http = require('http');
	const decodeTxRaw = require('@cosmjs/proto-signing').decodeTxRaw;
	const fromBase64 = require('@cosmjs/encoding').fromBase64;
	const crypto = require('crypto');
	const spawn = require('child_process').spawn;
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
			  'deployment/close-deployment':true,
			  'market/create-bid':true,
			  'market/close-bid':true,
			  'market/create-lease':true,
			  'market/close-lease':true,
			  'market/close-order':true
			}
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
						//check if this block is legit or not
						if(typeof json.error != "undefined"){
							if(json.error.indexOf('this transaction cannot be displayed via legacy REST endpoints') >= 0){
								//ok this is too big for Amino serialization.
								//so instead we'll get the raw txes/query tx individually....
								/*
								Example: curl http://localhost:1317/txs?tx.height=3146180
								this transaction cannot be displayed via legacy REST endpoints, because it does not support Amino serialization. 
								Please either use CLI, gRPC, gRPC-gateway, or directly query the Tendermint RPC endpoint to query this transaction. 
								The new REST endpoint (via gRPC-gateway) is /cosmos/tx/v1beta1/txs. Please also see theREST endpoints migration guide at https://docs.cosmos.network/master/migrations/rest.html for more info
								*/
								this.queryRawTxes(height,resolve);
							}
							else{
								console.log('block err other',json.error,height);
								resolve({height,json})
							}
						}
						else{
							resolve({height,json});
						}
						
						

					});
				});
				request.end();
			})
			
			
		}
		queryRawTxes(height,resolveDone){
			const spawnRaw = spawn('/usr/akash/bin/akash',['query','block',height],{shell:true});
			let rawBlock = '';
			spawnRaw.stdout.on('data',d=>{
				rawBlock += d.toString();
			})
			spawnRaw.stderr.on('data',d=>{
				console.log('rawtxerr',d.toString());
			})
			spawnRaw.on('close',()=>{
				let block = {};
				try{
					block = JSON.parse(rawBlock);
				}
				catch(e){
					console.log('no json response for raw tx query',rawBlock);
				}
				if(typeof block.block == "undefined"){
					resolveDone({height,json:block})
				}
				else{
					//ok look thru txes for anything we should harvest individually..
					let toHarvest = [];
					if(block.block.data.txs != null){
						block.block.data.txs.map(txRaw=>{
							const data = fromBase64(txRaw)
							let tx = decodeTxRaw(data);
							const txID = crypto.createHash("sha256").update(data).digest('hex');
							let shouldHarvest = false;

							tx.body.messages.map(msg=>{
								
								if(msg.typeUrl.indexOf('akash') >= 0){
									shouldHarvest = true;
								}
							})
							if(shouldHarvest){
								toHarvest.push(txID);
							}
							//tx.body.messages[0].value = Buffer.from(tx.body.messages[0].value).toString()
							if(typeof tx.signatures[0] != "undefined"){
								tx.signatures[0] = Buffer.from(tx.signatures[0]).toString()
							}
						});
					}
					if(toHarvest.length == 0){
						resolveDone({height,json:{}});
					}
					else{
						//ok lets get individual txes then...
						this.harvestIndividualTxes(toHarvest,block,height,resolveDone);
					}
				}

			})
		}
		harvestIndividualTxes(txIDs,block,height,resolveDone){
			let finished = 0;
			const total = txIDs.length;
			let output = new Array(total);
			txIDs.map((txID,i)=>{
				this.fetchIndividualTX(txID,i,height).then((data)=>{
					output[data.txI] = data.tx;
					finished += 1;
					if(finished == total){
						//ok we're done here
						
						let txOut = {
							txs:output
						}
						
						resolveDone({height,json:txOut});
					}
				})
			})
		}
		fetchIndividualTX(txID,i,height){
			return new Promise((resolve,reject)=>{
				const spawnTx = spawn('/usr/akash/bin/akash',['query','tx',txID,'--output','json'],{shell:true})
				let tx = '';
				spawnTx.stdout.on('data',d=>{
					tx += d.toString();
				})
				spawnTx.stderr.on('data',d=>{
					console.log('err fetching tx',d.toString(),height,txID);
				})
				spawnTx.on('close',()=>{
					let json = {};
					try{
						json = JSON.parse(tx);
					}
					catch(e){
						console.log('error parsing tx',txID,height,e,tx);
					}
					if(typeof json.tx != "undefined"){
						json.tx.value = {
							msg:[]
						};
					}
					//console.log('done fetching indiv tx',tx,txID);
					resolve({tx:json,txI:i});
				})
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
				console.log('unique types',this.uniqueTypes);
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
									
									if(typeof tx.codespace != "undefined"){
										if(tx.codespace == 'market'){
											/*const blockCodes = [23,24,12,8,18,6];
											if(blockCodes.indexOf(tx.code) >= 0){
												//return;
											}*/
											//always skip tx with a codespace err
											return;
											
										}

										if(tx.codespace == 'sdk'){
											/*const blockCodes = [5,11];
											if(blockCodes.indexOf(tx.code) >= 0){
												//return;
											}*/
											//always skip tx with a codespace err
											return;
										}
									}
									
									const events = this.manuallyParseCloseEventsFromTx(tx).concat(tx.tx.value.msg);
									
									events.map((msg,i)=>{
										let type = msg.type;
										//this.types[type] = true;
										this.uniqueTypes[type] = true;
										//console.log('types',type);
										
										
										if(this.eventTargets[type]){
											
											this.addToRedis(msg,i,type,tx);

										}
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
		manuallyParseCloseEventsFromTx(tx){
			//ok it seems that sometimes not all close types of events get a message created (like for close lease etc)
			//so we'll manually parse it out.
			let messages = [];
			
			function generateEventTemplate(){
				return {
					type:'',
					value:{
						id:{}
					}
				};
			}
			if(tx.logs && typeof tx.logs == 'object'){
				tx.logs.map(logType=>{
					if(typeof logType.events != "undefined"){
						logType.events.map(event=>{
							if(event.type == 'akash.v1'){
								let currentEvent;// = generateEventTemplate();
								event.attributes.map(attr=>{
									let key = attr.key;
									let value = attr.value;
									if(key == 'module'){
										if(typeof currentEvent == 'undefined'){
											currentEvent = generateEventTemplate();
										}
										else{
											messages.push(currentEvent);
											currentEvent = generateEventTemplate();
										}
										currentEvent.type += value;
									}
									else if(key == 'action'){
										
			  							let v = value;
			  							if(v == 'bid-closed'){
			  								v = 'close-bid';
			  							}
			  							if(v == 'bid-created'){
			  								v = 'create-bid';
			  							}
			  							if(v == 'lease-closed'){
			  								v = 'close-lease'
			  							}
			  							if(v == 'deployment-closed'){
			  								v = 'close-deployment'
			  							}
			  							if(v == 'lease-created'){
			  								v = 'create-lease';
			  							}
			  							if(v == 'order-closed'){
			  								v = 'close-order';
			  							}
										currentEvent.type += '/'+v;
									}
									else{
										currentEvent.value.id[key] = value;
									}
								});
								messages.push(currentEvent);
							}
						});
					}
				});
			}
			return messages;
			
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
		addToRedis(msg,i,type,ogTX){
			
			const {orderID,provider} = this.getIDsFromTXPayload(msg);
			/*if((orderID == 'akash1fnc04mjln6y0y7qgkkz9nwkjane50nnjxq32yf/2779907' || orderID == 'akash1fnc04mjln6y0y7qgkkz9nwkjane50nnjxq32yf/2885243') && (type == 'market/create-lease' || type == 'market/close-lease')){
				console.log('target order ID time',type,msg,ogTX);
			}*/
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
				//this.redis.zScore(provider,orderID).then(value=>{
					//if(value != 2 && value != 0){
						//ensure this open bid didnt hit after we already closed this bid
				this.redis.zAdd(provider,{score:1,value:orderID},(err,res)=>{});	
					//}
				//})
				
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
										val = 4; //closed lease
									}
									this.redis.zAdd(providerID,{score:val,value:orderID},(err,res)=>{});
								});
							});
							setTimeout(()=>{
								this.redis.del('lease_'+orderID);
							},5000)
						}
						if(type == 'market/close-order'){
							//ok we already closed the lease, now we need to mark the winner's bid as some special closed bid i guess
							this.redis.zAdd(leaseProvider,{score:0,value:orderID+'/close'});
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