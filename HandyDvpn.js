import fs from 'fs';
import path from 'path';
import url from 'url';
import {Daemon} from './dvpnAPI/Daemon.js';
import {DVPNSetup} from './dvpnAPI/Setup.js';
import {UpdateHelper} from './dvpnAPI/UpdateHelper.js';
import {DVPNStats} from './dvpnAPI/Stats.js';
import {CommonUtils} from './CommonUtils.js';
import {spawn} from 'child_process';

export class HandyDVPN{
	constructor(){
		this.ioNamespaces = {};
		this.redlistPortsPath = process.env.HOME+'/.HandyHost/ports.json';
		this.daemon = new Daemon();
		this.dvpnSetup = new DVPNSetup();
		this.updateHelper = new UpdateHelper();
		this.dvpnStats = new DVPNStats();
		this.handyUtils = new CommonUtils();
		try{
			fs.mkdirSync(`${process.env.HOME}/.HandyHost/sentinelData`,{recursive:true})
		}
		catch(e){
			//folder already exists
		}
		let acctName;
		try{
			acctName = fs.readFileSync(`${process.env.HOME}/.HandyHost/sentinelData/.nodeEnv`,'utf8');
		}
		catch(e){}
		
		if(typeof acctName != "undefined"){
			process.env.DVPN_ACCT_NAME = acctName.replace(/\n/g,'');
			//try startup here since we have already inited
		}
		setTimeout(()=>{
			//edge case: if I manually removed .sentinelnode for a clean install
			//left my old instance running, ran the installer, then started up,
			//the 2nd instance would fire ininConfigs on startup but never finish
			//because the new instance would fail **almost** immediately.
			//we add this timeout to give some buffer time..
			this.dvpnSetup.initConfigs(); //check if dvpn configs exist, create them if not.
		},100);
		setTimeout(()=>{
			//give some time to spin up before autostarting
			this.dvpnSetup.autostartDVPN(this.ioNamespaces); //make sure io exists before we autostart
		},5000);
	}
	addSocketNamespace(ioNamespace,serverName){
		//console.log('init sia sockets');
		this.ioNamespaces[serverName] = {namespace:ioNamespace};
		this.ioNamespaces[serverName].namespace.adapter.on("create-room", (room) => {
		  if(room.indexOf('dvpn') == 0){
		  	//start a Socket listener for this room
		  	this.initSocketListener(room,serverName);
		  }
		});

		this.ioNamespaces[serverName].namespace.adapter.on("delete-room", (room) => {
		  //console.log(`room deleted ${room}`);
		  if(room.indexOf('dvpn') == 0){
		  	//stop a Socket listener for this room
		  	this.removeSocketListener(room,serverName);
		  }
		});
		/*this.ioNamespaces[serverName].adapter.on("join-room", (room, id) => {
		  console.log(`socket ${id} has joined room ${room}`);
		});
		this.ioNamespaces[serverName].adapter.on("leave-room", (room, id) => {
		  console.log(`socket ${id} has left room ${room}`);
		});*/
		this.ioNamespaces[serverName].namespace.on('connection',(socket)=>{
			this.addSocketConnection(socket,serverName);
		});
	}
	addSocketConnection(socket,serverName){
		socket.emit('register');
		socket.on('subscribe',()=>{
			socket.join('dvpn');
			this.checkForUpdates(serverName);
		})
		socket.on('getAppStatus',()=>{
			let status = {};
			this.updateHelper.checkForUpdates().then(data=>{
				if(Object.keys(data).length > 0){
					status.current = data.current;
					status.latest = data.all[data.all.length-1];

					if(data.current != data.all[data.all.length-1]){
						status.isUpToDate = false;
					}
					else{
						status.isUpToDate = true;
					}
				}
				this.dvpnSetup.checkMachineStatus().then(isRunning=>{
					status.active = isRunning;
					socket.emit('versionStatus',status);
				}).catch(err=>{
					status.active = false;
					socket.emit('versionStatus',status);
				})
				
				
			})
			//separately check for handyhost updates
			let handyhostStatus = {};
			handyhostStatus.current = fs.readFileSync("./VERSION",'utf8').trim();
			this.handyUtils.checkForUpdates().then(data=>{
				console.log('hh version data??',data);
				handyhostStatus.isUpToDate = data.isUpToDate
				handyhostStatus.latest = data.latest;
				handyhostStatus.current = data.local;
				socket.emit('handyhostVersionStatus',handyhostStatus);
			}).catch(err=>{
				//couldnt ping github
				socket.emit('handyhostVersionStatus',handyhostStatus);
			})
			
		})

	}
	checkForUpdates(serverName){
		this.updateHelper.checkForUpdates().then(data=>{
			if(Object.keys(data).length > 0){
				if(data.current != data.all[data.all.length-1]){
					this.ioNamespaces[serverName].namespace.to('dvpn').emit('updatesAvailable',data);
				}
				else{
					this.ioNamespaces[serverName].namespace.to('dvpn').emit('nodeIsUpToDate');
				}
			}
		})
		this.handyUtils.checkForUpdates().then(data=>{
			console.log('HandyHost versionData',data);
			if(!data.isUpToDate){
				this.ioNamespaces[serverName].namespace.to('dvpn').emit('HandyHostUpdatesAvailable',data);
			}
			else{
				this.ioNamespaces[serverName].namespace.to('dvpn').emit('HandyHostIsUpToDate',data);
			}
		}).catch(error=>{
			console.log('error checking for handyhost updates',error);
		})
		//this.ioNamespace.to('dvpn').emit('updatesAvailable',data);
	}
	retrieveAnalytics(serverName){
		this.dvpnStats.getActiveSessionAnalytics().then(data=>{
			this.ioNamespaces[serverName].namespace.to('dvpn').emit('sessionAnalytics',data.json,data.timeseries);
		}).catch(error=>{
			this.ioNamespaces[serverName].namespace.to('dvpn').emit('sessionAnalytics',{},{});
		})
	}
	initSocketListener(room,serverName){
		//TODO: add when we get more stats on nodes..
		if(typeof this.ioNamespaces[serverName].updateCheckRoomInterval == "undefined"){
			//spin up an interval to send out stats
			this.ioNamespaces[serverName].updateCheckRoomInterval = setInterval(()=>{
				this.checkForUpdates(serverName);
			},60 * 1000 * 60); //hourly check for updates
		}
		if(typeof this.ioNamespaces[serverName].sessionAnalyticsInterval == "undefined"){
			this.ioNamespaces[serverName].sessionAnalyticsInterval = setInterval(()=>{
				this.retrieveAnalytics(serverName);
			},30*1000); //every 30s
		}

	}
	removeSocketListener(room,serverName){
		//everybody left the room, kill the update interval
		/*clearInterval(this.socketRoomInterval);
		delete this.socketRoomInterval;*/
		if(typeof this.ioNamespaces[serverName].updateCheckRoomInterval != "undefined"){
			clearInterval(this.ioNamespaces[serverName].updateCheckRoomInterval);
			delete this.ioNamespaces[serverName].updateCheckRoomInterval;
		}
		if(typeof this.ioNamespaces[serverName].sessionAnalyticsInterval != "undefined"){
			clearInterval(this.ioNamespaces[serverName].sessionAnalyticsInterval);
			delete this.ioNamespaces[serverName].sessionAnalyticsInterval;
		}
	}
	sendSocketUpdates(){
		/*
		this.ioNamespace.to('dvpn').emit('update',{
			chain:chainData,
			wallet:walletData,
			daemon: versionD
		});
		*/
	}
	api(path,requestBody,resolve,reject){
		switch(`${path[1]}`){
			case 'getState':
				//check if its installed
				this.dvpnStats.getState().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'initWallet':
				this.initWallet(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'getConfigs':
				this.getConfigs().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				});
			break;
			case 'getPortsRedlist':
				this.getPortsRedlist().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'updateNodeConfig':
				this.updateNodeConfig(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'getWallets':
				this.getWallets(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'launch':
				this.launchNode(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'stop':
				this.dvpnSetup.stopDVPN().then(()=>{
					resolve({stop:true})
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'updateDVPN':
				this.dvpnSetup.stopDVPN().then(()=>{
					this.updateHelper.updateDVPN(this.ioNamespaces).then(()=>{
						this.checkForUpdates();
						resolve({finished:true});
					}).catch(error=>{
						reject({error})
					})
				})
			break;
			case 'getDashboardStats':
				this.dvpnStats.getDashboardStats().then((data)=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'getActiveSessionAnalytics':
				this.dvpnStats.getActiveSessions().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
		}
		
	}
	getConfigs(){
		return new Promise((resolve,reject)=>{
			let operator = '';
			const operatorPath = `${process.env.HOME}/.HandyHost/sentinelData/.operator`;
			if(fs.existsSync(operatorPath)){
				operator = fs.readFileSync(operatorPath,'utf8');
			}
			this.dvpnSetup.getConfigs(true).then(data=>{
				resolve({operator,config:data});
			}).catch(error=>{
				reject(error);
			});
			
		})
	}
	getPortsRedlist(){
		return new Promise((resolve,reject)=>{
			let output = {default:{},custom:{}};
			if(fs.existsSync(this.redlistPortsPath)){
				output = JSON.parse(fs.readFileSync(this.redlistPortsPath,'utf8'));
			}
			resolve(output);
		})
	}
	launchNode(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		this.dvpnSetup.configureAutostart(parsed);
		return this.dvpnSetup.launchDVPN(parsed.pw,this.ioNamespaces);
	}
	getWallets(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		return this.dvpnSetup.getKeyList(parsed.pw);
	}
	updateNodeConfig(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		if(typeof parsed.operator != "undefined"){
			fs.writeFileSync(`${process.env.HOME}/.HandyHost/sentinelData/.operator`,parsed.operator,'utf8');
		}
		return this.dvpnSetup.updateConfigs(parsed.config)
	}
	initWallet(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		if(parsed.import){
			//init from seed
			return this.dvpnSetup.initWalletFromSeed(parsed.seed, parsed.pw, parsed.walletName);
		}
		else{
			return this.dvpnSetup.initWallet(parsed.pw, parsed.walletName);
		}
	}
	parseRequestBody(requestBody){
		let parsed;
		let err;
		try{
			parsed = JSON.parse(requestBody);
		}
		catch(e){
			err = e;
		}
		return {parsed,err};
	}
}