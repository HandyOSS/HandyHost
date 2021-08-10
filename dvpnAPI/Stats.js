import fs from 'fs';
import https from 'https';
import http from 'http';
import parse from 'parse-duration';
import {open} from 'sqlite';
import sqlite3 from 'sqlite3';
import QRCode from 'qrcode';

export class DVPNStats{
	constructor(){

	}
	getDVPNLogs(){
		//get dvpn logs on init;
		let lastLogs = '';
		if(fs.existsSync(`${process.env.HOME}/.HandyHost/dvpnData/hostLogs`)){
			return fs.readFileSync(`${process.env.HOME}/.HandyHost/dvpnData/hostLogs`,'utf8');
		}
		return lastLogs;
	}
	getState(){
		return new Promise((resolve,reject)=>{
			const exists = fs.existsSync(`${process.env.HOME}/.sentinelnode/keyring-file`);
			let output = {
				exists,
				state:{},
				active:false
			}
			if(exists){
				//see if its running..
				output.logs = this.getDVPNLogs();
				this.getMachineStatus().then(statusData=>{
					output.state = statusData;
					output.active = true;

					resolve(output);
				}).catch(error=>{
					output.state = error;
					resolve(output);
				})
			}
			else{
				resolve(output);
			}
		})
	}
	getMachineStatus(){
		return new Promise((resolve,reject)=>{
			const options = {
				host: 'localhost',
				port:'8585',
				path: '/status',
				method:'GET',
				rejectUnauthorized: false,
				//requestCert: true,
				agent: false
			};
			
			
			let output = '';
			const request = http.request(options,response=>{
				//another chunk of data has been received, so append it to `str`
				
				response.on('data', (chunk) => {
					output += chunk;
				});

				//the whole response has been received, so we just print it out here
				response.on('end', () => {
					let json = [];
					try{
						json = JSON.parse(output);
					}
					catch(e){
						console.log('bad json response',output.toString());
					}

					resolve(json);

				});

				if(response.statusCode.toString() != '200'){
					//something went wrong
					reject(output);
				}
			});

			request.on('error', (err)=> {
			    reject(err)
			});
			request.end();
		})
		
	}
	getWalletBalance(address){
		//https://api-sentinel.cosmostation.io/v1/account/total/balance/sent15slyktswyxs87e0nq4et5uxatmpnru9k007awk
		return new Promise((resolve,reject)=>{
			const options = {
				host: 'api-sentinel.cosmostation.io',
				port:'443',
				path: '/v1/account/total/balance/'+address,
				method:'GET',
				rejectUnauthorized: true,
				requestCert: true,
				agent: false
			};
			
			
			let output = '';
			const request = https.request(options,response=>{
				//another chunk of data has been received, so append it to `str`
				
				response.on('data', (chunk) => {
					output += chunk;
				});

				//the whole response has been received, so we just print it out here
				response.on('end', () => {
					console.log('resp',output);
					let json = [];
					try{
						json = JSON.parse(output);
					}
					catch(e){
						console.log('bad json response',output.toString());
					}

					resolve(json);

				});

				if(response.statusCode.toString() != '200'){
					//something went wrong
					reject(output);
				}
			});

			request.on('error', (err)=> {
			    reject(err)
			});
			request.end();
		})
	}
	getWalletTransactions(address){
		//https://api-sentinel.cosmostation.io/v1/account/txs/sent15slyktswyxs87e0nq4et5uxatmpnru9k007awk
		//https://api-sentinel.cosmostation.io/v1/account/new_txs/sent15slyktswyxs87e0nq4et5uxatmpnru9k007awk?from=0&limit=50
		console.log('get tx for',address);
		return new Promise((resolve,reject)=>{
			const options = {
				host: 'api-sentinel.cosmostation.io',
				port:'443',
				path: '/v1/account/new_txs/'+address+'?from=0&limit=50',
				method:'GET',
				rejectUnauthorized: true,
				requestCert: true,
				agent: false
			};
			
			
			let output = '';
			const request = https.request(options,response=>{
				//another chunk of data has been received, so append it to `str`
				
				response.on('data', (chunk) => {
					output += chunk;
				});

				//the whole response has been received, so we just print it out here
				response.on('end', () => {
					//console.log('tx output',output);
					let json = [];
					try{
						json = JSON.parse(output);
					}
					catch(e){
						console.log('bad json response',output.toString());
					}

					resolve(json);

				});

				if(response.statusCode.toString() != '200'){
					//something went wrong
					reject(output);
				}
			});

			request.on('error', (err)=> {
			    reject(err)
			});
			request.end();
		})
	}
	getDashboardStats(){
		//get historic transaction data
		let toComplete = 4;
		let hasCompleted = 0;
		let output = {
			node:{},
			balance:{},
			txes:[],
			activeSessions:[]
		}
		const _this = this;
		
		return new Promise((resolve,reject)=>{
			let walletAddress = fs.readFileSync(`${process.env.HOME}/.HandyHost/dvpnData/.operator`,'utf8');
			walletAddress = walletAddress.trim().replace(/\n/,'');
			if(typeof walletAddress == "undefined"){
				resolve(output) //get node stats and return them here
				return;
			}
			console.log('wallet addr?',walletAddress);
			this.getMachineStatus().then(statusData=>{
				output.node = statusData;
				hasCompleted++;
				finish(output,resolve);
			}).catch(err=>{
				console.log("err?? get machine status",err);
				hasCompleted++;
				finish(output,resolve);
			})
			this.getWalletBalance(walletAddress).then(json=>{
				output.balance = json;
				this.getQRCode(walletAddress).then((qr)=>{
					output.wallet = {
						address: walletAddress,
						qr: qr
					};
					hasCompleted++;
					finish(output,resolve);
				})
				
			}).catch(err=>{
				console.log("err?? get wallet bal",err);
				hasCompleted++;
				finish(output,resolve);
			});

			this.getWalletTransactions(walletAddress).then(json=>{
				output.txes = json;
				hasCompleted++;
				finish(output,resolve);
			}).catch(err=>{
				console.log("err?? get txes",err);
				
				hasCompleted++;
				finish(output,resolve);
			})
			this.getActiveSessionAnalytics().then(json=>{
				output.activeSessions = json;
				hasCompleted++;
				finish(output,resolve);
			}).catch(err=>{
				console.log('err get active sessions sqlite',err);
				hasCompleted++;
				finish(output,resolve);
			})
			
		})
		function finish(output,resolve){
			console.log('finished stats things',hasCompleted,toComplete);
			if(hasCompleted == toComplete){
				_this.modelTransactionData(output).then(txModeled=>{
					resolve(txModeled);
				})
			}
		}
		
	}
	getQRCode(walletAddress){
		return new Promise((resolve,reject)=>{
			resolve(QRCode.toDataURL(walletAddress));
		})
	}
	getActiveSessionAnalytics(){
		return new Promise((resolve,reject)=>{
			//sqlite check for active sessions
			open({filename:process.env.HOME+'/.sentinelnode/data.db',driver:sqlite3.Database}).then(db=>{
				console.log('db is loaded');

				db.all('SELECT DISTINCT subscription, SUM(download) as nodeDOWN, SUM(upload) as nodeUP, MIN(available) as subscriptionAvail, group_concat(id) as sessionIDs, MAX(created_at) as latestCreated, MAX(updated_at) as latestUpdated from SESSIONS group by subscription').then(d=>{
					//console.log('done',d);
					//make sessionIDs into array of ints
					const toReturn = d.map(rec=>{
						rec.sessionIDs = rec.sessionIDs.split(',').map(v=>{
							return parseInt(v);
						})
						return rec;
					})
					resolve(toReturn);
				});

			}).catch(e=>{
				console.log('err',e);
				reject(e);
			});

		});
	}
	modelTransactionData(output){
		let newOutput = output;
		console.log('model txes');
		return new Promise((resolve,reject)=>{
			if(output.txes.length == 0){
				resolve(newOutput);
				return;
			}
			else{
				//parse the responses
				newOutput = this.parseTxes(output);
				let totalBandwidthUP = 0;
				let totalBandwidthDOWN = 0;
				let sessionCount = 0;
				let uniqueSubscriptions = {};
				let avgDuration = 0;  // in seconds
				let durationSum = 0;
				let durationCount = 0;
				console.log('now model parsed txes');
				newOutput.txes.map(newtx=>{
					if(typeof newtx.data.tx.body.messages == "undefined"){
						return;
					}
					const tx = newtx.data.tx.body;

					tx.messages.map((msg,i)=>{
						//const msg = tx.messages[0];
						if(msg['@type'] == '/sentinel.session.v1.MsgUpdateRequest' && typeof msg.proof != "undefined"){
							//console.log('valid tx message',msg);
							//ok this is a proof request
							const durationString = msg.proof.duration;
							const durationMinutes = parse(msg.proof.duration,'m');
							const download = parseFloat(msg.proof.bandwidth.download);
							const upload = parseFloat(msg.proof.bandwidth.upload);
							const sessionID = msg.proof.id;
							let address,subscriptionID;

							newtx.data.logs[i].events.map(logEntry=>{
								logEntry.attributes.map(attr=>{
									if(attr.key == 'address'){
										address = attr.value.replace(/\"/gi,'');
									}
									if(attr.key == 'subscription'){
										subscriptionID = attr.value.replace(/\"/gi,'');
									}
								})
							});
							subscriptionID = subscriptionID+'_'+address; //likely unique subscribers have their own unique ints for subscription IDs...
							if(typeof uniqueSubscriptions[subscriptionID] == "undefined"){
								uniqueSubscriptions[subscriptionID] = {
									id:subscriptionID,
									address,
									durationSum:0,
									totalBandwidthUP:0,
									totalBandwidthDOWN:0,
									sessionCount:0
								}
							}
							uniqueSubscriptions[subscriptionID].durationSum += durationMinutes;
							uniqueSubscriptions[subscriptionID].totalBandwidthUP += upload;
							uniqueSubscriptions[subscriptionID].totalBandwidthDOWN += download;
							uniqueSubscriptions[subscriptionID].sessionCount += 1;
							totalBandwidthUP += upload;
							totalBandwidthDOWN += download;
							sessionCount += 1;
							durationSum += durationMinutes;
							durationCount += 1;
						}
					})
					
				});
				avgDuration = durationSum / durationCount;
				/*
				let totalBandwidthUP = 0;
				let totalBandwidthDOWN = 0;
				let sessionCount = 0;
				let uniqueSubscriptions = {};
				let avgDuration = 0;  // in seconds
				let durationSum = 0;
				let durationCount = 0;
				
				*/
				console.log('built analytics');
				newOutput.analytics = {
					totalBandwidthUP,
					totalBandwidthDOWN,
					sessionCount,
					uniqueSubscriptions,
					avgDuration,
					durationSum
				}
				resolve(newOutput);
			}
		})
	}
	parseTxes(output){
		output.txes.map(tx=>{
			Object.keys(tx).map(key=>{
				let val = tx[key];
				if(typeof val == 'string'){
				    let hadError = false;
				    try{
				        val = JSON.parse(val);
				    }
				    catch(e){
				        hadError = true;
				    }
				    if(!hadError && typeof val == 'string'){
				        try{
				            val = JSON.parse(val);
				        }
				        catch(e){
				            
				        }
				    }
				    tx[key] = val;
				}
			})
		});
		return output;
	}
}