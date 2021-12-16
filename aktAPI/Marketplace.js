import {spawn} from 'child_process';
import {EnvUtils} from './envUtils.js';
import {CommonUtils} from '../CommonUtils.js';
import http from 'http';
export class Marketplace{
	constructor(){
		this.envUtils = new EnvUtils();
		this.commonUtils = new CommonUtils();
	}
	getOrders(params){
		return new Promise((resolve,reject)=>{
			console.log('get orders params',params);
			const orderLimit = typeof params.limit == "undefined" ? 25 : params.limit;
			let args = ['query', 'market', 'order', 'list', '--state', 'open','--limit',orderLimit,'--output','json','--count-total'];
			if(typeof params.page != "undefined"){
				args.push('--page',params.page)
			}
			const s = spawn('./bin/akash',args,{shell:true,env:process.env,cwd:process.env.HOME+'/.HandyHost/aktData'});
			let output = '';
			let errOut = '';
			s.stdout.on('data',d=>{
				output += d.toString();
			})
			s.stderr.on('data',d=>{
				console.log('AKT: getOrders error',d.toString());
				errOut += d.toString();
			});
			s.on('close',()=>{
				if(errOut != ''){
					reject({error:errOut});
				}
				else{
					let json = {};
					try{
						json = JSON.parse(output);
					}
					catch(e){
						reject({error:output})
					}
					resolve(json);
				}
			})
		}).catch(error=>{
			this.envUtils.trySetEnv(); //reset env on fail
		})
	}
	getOrder(params){
		return new Promise((resolve,reject)=>{
			console.log('get order params',params);
			let args = ['query', 'market', 'order', 'get', '--owner', params.owner, '--dseq', params.dseq, '--gseq', params.gseq, '--oseq', params.oseq, '--output','json'];
			
			const s = spawn('./bin/akash',args,{shell:true,env:process.env,cwd:process.env.HOME+'/.HandyHost/aktData'});
			let output = '';
			let errOut = '';
			s.stdout.on('data',d=>{
				output += d.toString();
			})
			s.stderr.on('data',d=>{
				console.log('AKT: getOrder error',d.toString());
				errOut += d.toString();
			});
			s.on('close',()=>{
				if(errOut != ''){
					reject({error:errOut});
				}
				else{
					let json = {};
					try{
						json = JSON.parse(output);
					}
					catch(e){
						reject({error:output})
					}
					resolve(json);
				}
			})
		})
		.catch(error=>{
			this.envUtils.trySetEnv(); //reset env on fail
		})
	}
	getBids(params,wallet){
		return new Promise((resolve,reject)=>{
			console.log('get orders params',params);
			const orderLimit = typeof params.limit == "undefined" ? 25 : params.limit;
			let args = ['query', 'market', 'bid', 'list', '--limit', orderLimit, '--output', 'json', '--provider', wallet, '--count-total'];
			if(typeof params.page != "undefined"){
				args.push('--page',params.page)
			}
			if(typeof params.state != "undefined"){
				args.push('--state',params.state);
			}
			const s = spawn('./bin/akash',args,{shell:true,env:process.env,cwd:process.env.HOME+'/.HandyHost/aktData'});
			let output = '';
			let errOut = '';
			s.stdout.on('data',d=>{
				output += d.toString();
			})
			s.stderr.on('data',d=>{
				console.log('AKT: getBids error',d.toString());
				errOut += d.toString();
			});
			s.on('close',()=>{
				if(errOut != ''){
					reject({error:errOut});
				}
				else{
					let json = {};
					try{
						json = JSON.parse(output);
					}
					catch(e){
						reject({error:output})
					}
					resolve(json);
				}
			})
		}).catch(error=>{
			this.envUtils.trySetEnv(); //reset env on fail
		});
	}
	getLeases(params,wallet){
		return new Promise((resolve,reject)=>{
			console.log('get leases params',params);
			const orderLimit = typeof params.limit == "undefined" ? 25 : params.limit;
			let args = ['query', 'market', 'lease', 'list', '--limit', orderLimit, '--output', 'json', '--provider', wallet, '--count-total'];
			if(typeof params.page != "undefined"){
				args.push('--page',params.page)
			}
			if(typeof params.state != "undefined"){
				args.push('--state',params.state);
			}
			const s = spawn('./bin/akash',args,{shell:true,env:process.env,cwd:process.env.HOME+'/.HandyHost/aktData'});
			let output = '';
			let errOut = '';
			s.stdout.on('data',d=>{
				output += d.toString();
			})
			s.stderr.on('data',d=>{
				console.log('AKT: getLeases error',d.toString());
				errOut += d.toString();
			});
			s.on('close',()=>{
				if(errOut != ''){
					reject({error:errOut});
					this.envUtils.trySetEnv(); //reset env on fail
				}
				else{
					let json = {};
					try{
						json = JSON.parse(output);
					}
					catch(e){
						reject({error:output})
					}
					resolve(json);
				}
			})
		}).catch(error=>{
			this.envUtils.trySetEnv(); //reset env on fail
		});
	}
	getMarketAggregatesLegacyRPC(wallet,resolveOGCall){
		return new Promise((resolve,reject)=>{
			const now = Math.floor(new Date().getTime()/1000);
			if(typeof this.lastAggs != "undefined"){
				//check age of last aggregate
				//we cache for the last 20 minutes because these are taxing on the rpc server. TODO: redis in front of rpc for fast stats lookups...
				let lastAggTime = this.lastAggs.time;
				if((now - lastAggTime) < 90){
					resolveOGCall(this.lastAggs.data);

					return;
				}
			}
			const argsLeasesActive = ['query', 'market', 'lease', 'list', '--limit', 1, '--output', 'json', '--provider', wallet, '--count-total','--state','active'];
			const argsLeasesClosed = ['query', 'market', 'lease', 'list', '--limit', 1, '--output', 'json', '--provider', wallet, '--count-total','--state','closed'];
			const argsBidsOpen = ['query', 'market', 'bid', 'list', '--limit', 1, '--output', 'json', '--provider', wallet, '--count-total','--state','open'];
			const argsBidsClosed = ['query', 'market', 'bid', 'list', '--limit', 1, '--output', 'json', '--provider', wallet, '--count-total','--state','closed'];
			const argsBidsLost = ['query', 'market', 'bid', 'list', '--limit', 1, '--output', 'json', '--provider', wallet, '--count-total','--state','lost'];
			let total = 5;

			let leasesActive = 0;
			let leasesClosed = 0;
			let bidsOpen = 0;
			let bidsClosed = 0;
			let bidsLost = 0;
			let finished = 0;
			if(typeof wallet == "undefined"){
				finish(total);
			}
			else{
				this.getAggregatesQuery(argsLeasesActive).then(data=>{
					leasesActive = data;
					finished+=1;
					finish(finished);
				})
				this.getAggregatesQuery(argsLeasesClosed).then(data=>{
					leasesClosed = data;
					finished+=1;
					finish(finished);
				})
				this.getAggregatesQuery(argsBidsOpen).then(data=>{
					bidsOpen = data;
					finished+=1;
					finish(finished);
				})
				this.getAggregatesQuery(argsBidsClosed).then(data=>{
					bidsClosed = data;
					finished+=1;
					finish(finished);
				})
				this.getAggregatesQuery(argsBidsLost).then(data=>{
					bidsLost = data;
					finished+=1;
					finish(finished);
				})
			}
			
			const _this = this;
			function finish(finished){
				if(finished == total){
					const dataOut = {
						leasesActive,
						leasesClosed,
						bidsOpen,
						bidsClosed,
						bidsLost
					};
					_this.lastAggs = {
						time: Math.floor(new Date().getTime()/1000),
						data: dataOut
					};
					resolveOGCall(dataOut)
				}
			}

			
		}).catch(error=>{
			//this.envUtils = new EnvUtils();
			this.envUtils.trySetEnv(); //reset env on fail
		})
	}
	getMarketAggregates(wallet){
		//fallback to legacy if this fails
		return new Promise((resolve,reject)=>{
			const url = 'http://rpc-1.handyhost.computer:26659/'+wallet;
			let output = '';
			const request = http.request(url,response=>{

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
					const dataOut = {
						leasesActive: json.active_leases,
						leasesClosed: json.closed_leases,
						bidsOpen: json.open_bids,
						bidsClosed: json.closed_bids,
						bidsLost: json.lost_bids
					};
					this.lastAggs = {
						time: Math.floor(new Date().getTime()/1000),
						data: dataOut
					};
					resolve(dataOut);
				});
				
			});
			request.on('error',(e)=>{
				console.log('error calling',url,e);
				this.getMarketAggregatesLegacyRPC(wallet,resolve);
			})
			request.end();
			
			
		})
	}
	getAggregatesQuery(args){
		return new Promise((resolve,reject)=>{
			this.tryAggregatesQuery(args,resolve,reject,0)
		}).catch(error=>{
			this.envUtils.trySetEnv(); //reset env on fail
		})
	}
	tryAggregatesQuery(args,resolve,reject,attemptCount){
		let output = '';
		let errOut = '';
		process.env.AKASH_NODE='http://rpc-1.handyhost.computer'; //aggs queries timeout a lot. We run our own node with high timeout times
		const s = spawn('./bin/akash',args,{shell:true,env:process.env,cwd:process.env.HOME+'/.HandyHost/aktData'});
		s.stdout.on('data',d=>{
			output += d.toString();
		})
		s.stderr.on('data',d=>{
			console.log('AKT: get aggregates query error',d.toString());
			errOut += d.toString();
		});
		s.on('close',()=>{
			if(errOut != ''){
				if((errOut.indexOf('Error: post failed') >= 0 && errOut.indexOf('EOF') >= 0) || errOut.indexOf('Error: error unmarshalling') >= 0){
					//rpc error, retry...
					if(attemptCount >= 10){
						console.log('reset env attempt is too many, failing now...')
						reject({error:errOut})
						return;
					}
					console.log('RPC request failed, reset env and try again...')
					this.envUtils.setEnv().then(()=>{
						console.log('reset env attempt',attemptCount)
						setTimeout(()=>{
							this.tryAggregatesQuery(args,resolve,reject,attemptCount+1);
						},1000)
						
					}).catch(e=>{
						console.log('failed to reset env, retrying...')
						setTimeout(()=>{
							this.tryAggregatesQuery(args,resolve,reject,attemptCount+1);
						},1000)
						
					}); //reset env on fail
				}
				else{
					reject({error:errOut});
				}
				
				
			}
			else{
				let json = {};
				try{
					json = JSON.parse(output);
				}
				catch(e){
					reject({error:output})
				}
				//console.log('aggregates query was successful');
				resolve(json.pagination.total);
			}
		});
	}
	getCurrentChainHeight(){
		return new Promise((resolve,reject)=>{
			let output = '';
			const p = spawn('./bin/akash',['status'],{shell:true,env:process.env,cwd:process.env.HOME+'/.HandyHost/aktData'})
			p.stdout.on('data',d=>{
				output += d.toString();
			})
			p.stderr.on('data',d=>{
				console.log('error fetching chain',d.toString())
				this.envUtils.trySetEnv(); //reset env on fail
			})
			p.on('close',()=>{
				let json = {};
				let height = -1;
				try{
					json = JSON.parse(p);
				}
				catch(e){

				}
				if(typeof json['SyncInfo'] != "undefined"){
					height = parseInt(json['SyncInfo']['latest_block_height']);
				}
				resolve(height);
			})
		});
	}
	createBid(params,walletName){
		/*
		const params = {
			pw:$('#marketplacePW').val(),
			price:$('#price').val(),
			deposit:$('#deposit').val(),
			orderData
		};
		*/
		//no need to update this for rpc goodness, we cant place manual bids rn..
		return new Promise((resolve,reject)=>{
			
			/*const args = [
				'./placeBid.sh',
				this.commonUtils.escapeBashString(params.pw),
				(params.deposit+'uakt' || '50000000uakt'),
				(params.price+'uakt' || '1uakt'),
				params.orderData.order_id.dseq,
				params.orderData.order_id.gseq,
				params.orderData.order_id.oseq,
				'10000uakt',
				this.commonUtils.escapeBashString(walletName),
				params.orderData.order_id.owner
			]*/
			const args = [
				'tx', 'market', 'bid', 'create',
				'--deposit', (params.deposit+'uakt' || '50000000uakt'),
				'--price', (params.price+'uakt' || '1uakt'),
				'--dseq', params.orderData.order_id.dseq,
				'--gseq', params.orderData.order_id.gseq,
				'--oseq', params.orderData.order_id.oseq,
				'--fees', '10000uakt',
				'--gas', 'auto',
				'--keyring-backend', 'file',
				'--from', this.commonUtils.escapeBashString(walletName),
				'--node', `${process.env.AKASH_NODE}`,
				'--owner', params.orderData.order_id.owner
			]
			this.getCurrentChainHeight().then(height=>{
				if(height >= 0){
					let defaultExpiry = 7200;
					if(typeof params.bidTTL != "undefined"){
						defaultExpiry = params.bidTTL
					}
					args.push(
						(height + defaultExpiry)
					);
				}
				args.push('-y');
				console.log('args',args);
				const p = spawn(`${process.env.HOME}/.HandyHost/aktData/bin/akash`,args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
				p.stdin.write(`${this.commonUtils.escapeBashString(params.pw)}\n`);
			
				//now finish
				//const p = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
				let output = '';
				let errOut = '';
				p.stdout.on('data',d=>{
					output += d.toString();
					console.log('bid create output',d.toString());
				})
				p.stderr.on('data',d=>{
					errOut += d.toString();
					console.log('err bid output',d.toString());
					this.envUtils.trySetEnv(); //reset env on fail
				})
				p.stdin.end();
				p.on('close',()=>{
					let json = {};
					try{
						json = JSON.parse(output);
					}
					catch(e){

					}

					if(Object.keys(json).length == 0){
						resolve({success:false,error:true,message:output+'; '+errOut})
					}
					else{
						if(json.codespace == '' && json.code == 0){
							resolve({success:true,message:'Successfully created bid.'})
						}
						if(json.codespace == 'sdk'){
							resolve({success:false,error:true,message:json.raw_log})
						}
						
					}
					
				})
			})
		}).catch(error=>{
			this.envUtils.trySetEnv(); //reset env on fail
		})
		
	}
	cancelBid(params,walletName){
		/*
		const params = {
			pw:$('#marketplacePW').val(),
			price:$('#price').val(),
			deposit:$('#deposit').val(),
			orderData
		};
		*/
		return new Promise((resolve,reject)=>{
			
			/*const args = [
				'./cancelBid.sh',
				this.commonUtils.escapeBashString(params.pw),
				params.orderData.order_id.dseq,
				params.orderData.order_id.gseq,
				params.orderData.order_id.oseq,
				'10000uakt',
				this.commonUtils.escapeBashString(walletName),
				params.orderData.order_id.owner,
				params.orderData.order_id.provider
			]*/
			const args = [
				'tx', 'market', 'bid', 'close',
				'--dseq', params.orderData.order_id.dseq,
				'--gseq', params.orderData.order_id.gseq,
				'--oseq', params.orderData.order_id.oseq,
				'--fees', '10000uakt',
				'--gas', 'auto',
				'--keyring-backend', 'file',
				'--from', this.commonUtils.escapeBashString(walletName),
				'--node' `${process.env.AKASH_NODE}`,
				'--owner', params.orderData.order_id.owner,
				'--provider', params.orderData.order_id.provider,
				'-y'
			];
			const p = spawn(`${process.env.HOME}/.HandyHost/aktData/bin/akash`,args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
			p.stdin.write(`${this.commonUtils.escapeBashString(params.pw)}\n`);
			console.log('args',args);
			
			//const p = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
			let output = '';
			let errOut = '';
			p.stdout.on('data',d=>{
				output += d.toString();
				console.log('bid cancel output',d.toString());
			})
			p.stderr.on('data',d=>{
				errOut += d.toString();
				console.log('err bid output',d.toString());
				this.envUtils.trySetEnv(); //reset env on fail
			})
			p.stdin.end();
			p.on('close',()=>{
				let json = {};
				try{
					json = JSON.parse(output);
				}
				catch(e){

				}

				if(Object.keys(json).length == 0){
					resolve({success:false,error:true,message:output+'; '+errOut})
				}
				else{
					if(json.codespace == '' && json.code == 0){
						resolve({success:true,message:'Successfully closed bid.'})
					}
					if(json.codespace == 'sdk'){
						resolve({success:false,error:true,message:json.raw_log})
					}
					
				}
				
			})
		
		}).catch(error=>{
			this.envUtils.trySetEnv(); //reset env on fail
		})
	}
	fetchAllOrderBids(bid,params){
		////bid.bid.bid_id.owner+'/'+bid.bid.bid_id.dseq+'/'+bid.bid.bid_id.gseq+'/'+bid.bid.bid_id.oseq;
		
		return new Promise((resolve,reject)=>{
			this.tryFetchAllOrderBids(bid,params,resolve,reject,0);
		}).catch(error=>{
			this.envUtils.trySetEnv(); //reset env on fail
		});
	}
	tryFetchAllOrderBids(bid,params,resolve,reject,attemptCount){
		console.log('get all bids params',bid,params);
		const orderLimit = typeof params.limit == "undefined" ? 25 : params.limit;
		let args = ['query', 'market', 'bid', 'list','--owner',bid.bid.bid_id.owner,'--dseq',bid.bid.bid_id.dseq,'--gseq',bid.bid.bid_id.gseq,'--oseq',bid.bid.bid_id.oseq,'--limit',orderLimit,'--output','json','--count-total'];
		if(typeof params.page != "undefined"){
			args.push('--page',params.page)
		}
		const s = spawn('./bin/akash',args,{shell:true,env:process.env,cwd:process.env.HOME+'/.HandyHost/aktData'});
		let output = '';
		let errOut = '';
		s.stdout.on('data',d=>{
			output += d.toString();
		})
		s.stderr.on('data',d=>{
			console.log('AKT: fetchAllOrderBids error',d.toString());
			errOut += d.toString();
		});
		s.on('close',()=>{
			if(errOut != ''){
				/*this.envUtils.trySetEnv(); //reset env on fail
				reject({error:errOut});*/
				if(errOut.indexOf('Error: post failed') >= 0 && errOut.indexOf('EOF') >= 0){
					//rpc error, retry...
					if(attemptCount >= 10){
						console.log('reset env attempt is too many, failing now...')
						reject({error:errOut})
						return;
					}
					console.log('RPC request failed, reset env and try again...')
					this.envUtils.setEnv().then(()=>{
						console.log('reset env attempt',attemptCount)
						setTimeout(()=>{
							this.tryFetchAllOrderBids(bid,params,resolve,reject,attemptCount+1)
							//this.tryAggregatesQuery(args,resolve,reject,attemptCount+1);
						},1000)
						
					}).catch(e=>{
						console.log('failed to reset env, retrying...')
						setTimeout(()=>{
							this.tryFetchAllOrderBids(bid,params,resolve,reject,attemptCount+1)
							//this.tryAggregatesQuery(args,resolve,reject,attemptCount+1);
						},1000)
						
					}); //reset env on fail
				}
				else{
					reject({error:errOut});
				}
			}
			else{
				let json = {};
				try{
					json = JSON.parse(output);
				}
				catch(e){
					reject({error:output})
				}
				resolve(json);
			}
		})
	}

}