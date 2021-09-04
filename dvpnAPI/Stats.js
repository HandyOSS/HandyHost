import fs from 'fs';
import https from 'https';
import http from 'http';
import parse from 'parse-duration';
import {open} from 'sqlite';
import sqlite3 from 'sqlite3';
import QRCode from 'qrcode';

import {DVPNSetup} from './Setup.js';

export class DVPNStats{
	constructor(){
		this.dvpnSetup = new DVPNSetup();
		open({filename:process.env.HOME+'/.HandyHost/sentinelData/sessionsTimeseries.db',driver:sqlite3.Database}).then(db=>{
			this.timeseriesDB = db;
			this.timeseriesDB.run(`
				CREATE TABLE IF NOT EXISTS subscribers (
					id INTEGER PRIMARY KEY,
					subscriber INTEGER NOT NULL,
					session INTEGER NOT NULL,
				   	download INTEGER NOT NULL,
				   	upload INTEGER NOT NULL,
				   	deltaDown INTEGER NOT NULL,
				   	deltaUp INTEGER NOT NULL,
				   	totalDown INTEGER NOT NULL,
				   	totalUp INTEGER NOT NULL,
				   	remaining INTEGER NOT NULL,
				   	created_at INTEGER NOT NULL
				);
			`);
			this.timeseriesDB.run(`
				CREATE TABLE IF NOT EXISTS sessions (
					session INTEGER,
					subscriber INTEGER NOT NULL
				);
			`);
		});
	}
	getDVPNLogs(){
		//get dvpn logs on init;
		let lastLogs = '';
		if(fs.existsSync(`${process.env.HOME}/.HandyHost/sentinelData/hostLogs`)){
			return fs.readFileSync(`${process.env.HOME}/.HandyHost/sentinelData/hostLogs`,'utf8');
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
			this.dvpnSetup.getPorts().then(ports=>{
				const options = {
					host: 'localhost',
					port: ports.node,
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
			}).catch(e=>{
				reject(e);
			})
			
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
		let toComplete = 5;
		let hasCompleted = 0;
		let output = {
			node:{},
			balance:{},
			txes:[],
			activeSessions:[]
		}
		const _this = this;
		
		return new Promise((resolve,reject)=>{
			let walletAddress = fs.readFileSync(`${process.env.HOME}/.HandyHost/sentinelData/.operator`,'utf8');
			walletAddress = walletAddress.trim().replace(/\n/,'');
			if(typeof walletAddress == "undefined"){
				resolve(output) //get node stats and return them here
				return;
			}
			console.log('wallet addr?',walletAddress);
			this.getMachineStatus().then(statusData=>{
				output.node = statusData;
				console.log('got machine stats');
				hasCompleted++;
				finish(output,resolve);
			}).catch(err=>{
				console.log("err?? get machine status",err);
				hasCompleted++;
				finish(output,resolve);
			})
			this.getQRCode(walletAddress).then((qr)=>{
				output.wallet = {
					address: walletAddress,
					qr: qr
				};
				hasCompleted++;
				finish(output,resolve);
			}).catch(err=>{
				hasCompleted++;
				finish(output,resolve);
			})
			this.getWalletBalance(walletAddress).then(json=>{
				output.balance = json;
				
				hasCompleted++;
				finish(output,resolve);
				
			}).catch(err=>{
				console.log("err?? get wallet bal",err);
				hasCompleted++;
				finish(output,resolve);
			});

			this.getWalletTransactions(walletAddress).then(json=>{
				output.txes = json;
				console.log('got tx data');
				hasCompleted++;
				finish(output,resolve);
			}).catch(err=>{
				console.log("err?? get txes",err);
				
				hasCompleted++;
				finish(output,resolve);
			})
			this.getActiveSessionAnalytics().then((d)=>{
				output.activeSessions = d.json;
				output.timeseries = d.timeseries;
				output.sessions = d.sessions;
				console.log('got analytcs data');
				console.log('timeseries data set???',typeof output.timeseries);
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
					this.updateTimeSeries(toReturn).then(()=>{
						console.log('time series was updated, now do query');
						this.getTimeseriesChart().then(timeseries=>{
							this.getSessionAnalytics().then(sessionAnalytics=>{
								console.log('timeseries??????');
								resolve({json:toReturn,timeseries:timeseries,sessions:sessionAnalytics});
							})
							
							//resolve(toReturn,timeseries);
						})
					});
					
				}).catch(e=>{
					console.log('error querying sessions DB',e);
					resolve({json:[],timeseries:{},sessions:{}});
				})

			}).catch(e=>{
				console.log('err',e);
				reject(e);
			});

		});
	}
	updateTimeSeries(sessions){
		return new Promise((resolve,reject)=>{
			console.log('update time series db',sessions.length);
			if(sessions.length == 0){
				resolve();
				return;
			}
			
			sessions.map(session=>{
				const subscriber = session.subscription;
				const sessionID = Math.max(...session.sessionIDs);
				const remaining = session.subscriptionAvail;
				let download = session.nodeUP;
				let upload = session.nodeDOWN; //from the perspective of the client
				let deltaDown = 0;
				let deltaUp = 0;
				let totalDown = 0;
				let totalUp = 0;
				let forceWrite = false;
				const createdAt = Math.floor(new Date().getTime()/1000);
				console.log('reqdy to insert into timeseries',subscriber,sessionID,download,upload,deltaDown,deltaUp,createdAt);
				this.timeseriesDB.all(`SELECT * FROM subscribers WHERE subscriber = ? ORDER BY created_at DESC LIMIT 1`,[subscriber]).then((res)=>{
					console.log('time series db query success',res);
					if(res.length > 0){
						if( parseInt(res[0].created_at) + 240 >= createdAt ){
							//only set delta if this is a recent session
							//the first instance should always be zero else the chart looks wonky 
							//and we double add into total bandwidth served
							deltaDown = Math.abs(download - res[0].download);
							deltaUp = Math.abs(upload - res[0].upload);
						}
						else{
							if(download > 0 && upload > 0){
								forceWrite = true; 
								//make sure we capture something to start the timeseries off aka this is new session
							}
						}
						totalDown = res[0].totalDown;
						totalUp = res[0].totalUp;
					}
					else{
						forceWrite = true; //make sure we capture something to start the timeseries off aka this is new
					}
					totalDown += deltaDown;
					totalUp += deltaUp;
					if(deltaDown > 0 || deltaUp > 0 || forceWrite){
						this.timeseriesDB.run(`INSERT INTO subscribers (subscriber,session,download,upload,deltaDown,deltaUp,totalDown,totalUp,remaining,created_at) VALUES (?,?,?,?,?,?,?,?,?,strftime(?))`,[subscriber,sessionID,download,upload,deltaDown,deltaUp,totalDown,totalUp,remaining,createdAt]).then(res=>{
							console.log('inserted into time series');
							resolve();
						});
					}
					else{
						console.log('no insert into time series, delta is 0')
						resolve();
					}
					
				}).catch(error=>{
					console.log('err running sqlite query',error);
					resolve();
				});

				this.timeseriesDB.all('SELECT * FROM sessions WHERE subscriber = ? AND session = ?',[subscriber,sessionID]).then(res=>{
					if(res.length == 0){
						//its new
						this.timeseriesDB.run('INSERT INTO sessions (session,subscriber) VALUES (?,?)',[sessionID,subscriber]).then(res=>{
							console.log('inserted new session into sessions table');
							//resolve();
						})
					}
					else{
						//resolve();
					}
				}).catch(error=>{	
					console.log('error querying session table',error)
					//resolve();
				})

				
			})
		})
		

	}
	getSessionAnalytics(){
		return new Promise((resolve,reject)=>{
			let uniqueSubscribers = 0;
			let sessions = 0;
			let subscribers = {}
			this.timeseriesDB.all(`SELECT subscriber, COUNT(session) as sessionCount FROM sessions GROUP BY subscriber`).then(res=>{
				uniqueSubscribers = res.length;
				res.map(row=>{
					sessions += row.sessionCount;
					subscribers[row.subscriber] = {
						sessions: row.sessionCount,
						totalDown:0,
						totalUp:0,
						remaining:0,
						lastSeen:0
					}
				});
				this.timeseriesDB.all(`SELECT MAX(totalDown) as down, MAX(totalUp) as up, MIN(remaining) as remains, MAX(created_at) as lastSeen, subscriber FROM subscribers GROUP BY subscriber`).then(meta=>{
					meta.map(row=>{
						subscribers[row.subscriber].totalDown = row.down;
						subscribers[row.subscriber].totalUp = row.up;
						subscribers[row.subscriber].remaining = row.remains;
						subscribers[row.subscriber].lastSeen = row.lastSeen;
					})
					resolve(subscribers);
				})
			})
		})
	}
	getTimeseriesChart(){
		return new Promise((resolve,reject)=>{
			const gte = Math.floor(new Date().getTime()/1000) - (86400*2);
			let subs = {};
			let timeMin = Infinity;
			let timeMax = -Infinity;
			console.log('get timeseries');
			this.timeseriesDB.all(`SELECT * FROM subscribers WHERE created_at > strftime(?) ORDER BY created_at ASC`,[gte]).then((res)=>{
				let uniqueSubs = {};
				//console.log('subscribers timeseries data???',res.length);
				res.map(record=>{
					//console.log('record',record);
					timeMax = Math.max(timeMax,record.created_at);
					timeMin = Math.min(timeMin,record.created_at);
					if(typeof subs[record.subscriber] == "undefined"){
						subs[record.subscriber] = {};
					}
				});
				/*let minDateMins = new Date(timeMin);
				minDateMins = Math.floor(new Date(timeMin - (minDateMins.getSeconds()*1000)).getTime()/1000);
				let maxDateMins = new Date(timeMax);
				maxDateMins = Math.floor(new Date(timeMax - (maxDateMins.getSeconds()*1000)).getTime()/1000);*/
				const minDateMins = this.getXTimestampMinute(timeMin*1000);
				const maxDateMins = this.getXTimestampMinute(timeMax*1000);
				//console.log('mindate mins maxdate mins',minDateMins,maxDateMins);
				let bins = {};
				for(let i=minDateMins;i<maxDateMins;i += 120){
					bins[i] = {up:0,down:0,sum:0};
				}
				Object.keys(subs).map(id=>{
					subs[id] = JSON.parse(JSON.stringify(bins));
				})
				

				res.map(record=>{
					const timestampRounded = this.getXTimestampMinute(new Date(record.created_at*1000));
					if(typeof subs[record.subscriber][timestampRounded] != "undefined"){
						subs[record.subscriber][timestampRounded].up = record.deltaUp;
						subs[record.subscriber][timestampRounded].down = record.deltaDown;
						subs[record.subscriber][timestampRounded].sum = record.deltaUp + record.deltaDown;
					}
				})
				//console.log('timeseries data???',subs);
				resolve(subs);

				//round to lowest minute

			}).catch(error=>{
				console.log('error building timeseries',error);
			})
		}).catch(error=>{
			console.log('error building timeseries',error);
		})
	}
	getXTimestampMinute(timestamp){
		//get timestamp in seconds rounded down to nearest minute
		const out = new Date(timestamp);
		return Math.floor(new Date(timestamp - (out.getSeconds()*1000)).getTime()/1000);
			
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