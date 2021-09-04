import fs from 'fs';
import path from 'path';
import url from 'url';
import {Daemon} from './dvpnAPI/Daemon.js';
import {DVPNSetup} from './dvpnAPI/Setup.js';
import {UpdateHelper} from './dvpnAPI/UpdateHelper.js';
import {DVPNStats} from './dvpnAPI/Stats.js';
import {spawn} from 'child_process';

export class HandyDVPN{
	constructor(){
		this.redlistPortsPath = process.env.HOME+'/.HandyHost/ports.json';
		this.daemon = new Daemon();
		this.dvpnSetup = new DVPNSetup();
		this.updateHelper = new UpdateHelper();
		this.dvpnStats = new DVPNStats();
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
		this.dvpnSetup.initConfigs(); //check if dvpn configs exist, create them if not.
		
	}
	addSocketNamespace(ioNamespace){
		//this.io.of('/dvpn')
		//console.log('init dvpn sockets');
		this.ioNamespace = ioNamespace;
		this.ioNamespace.adapter.on("create-room", (room) => {
		  if(room.indexOf('dvpn') == 0){
		  	//start a Socket listener for this room
		  	this.initSocketListener(room);
		  }
		});

		this.ioNamespace.adapter.on("delete-room", (room) => {
		  console.log(`room deleted ${room}`);
		  if(room.indexOf('dvpn') == 0){
		  	//stop a Socket listener for this room
		  	this.removeSocketListener(room);
		  }
		});
		this.ioNamespace.adapter.on("join-room", (room, id) => {
		  console.log(`socket ${id} has joined room ${room}`);
		});
		this.ioNamespace.adapter.on("leave-room", (room, id) => {
		  console.log(`socket ${id} has left room ${room}`);
		});
		//console.log('setup connection events');
		this.ioNamespace.on('connection',(socket)=>{
			console.log('new connection');
			this.addSocketConnection(socket);
		});
	}
	addSocketConnection(socket){
		console.log('add socket connection');
		socket.emit('register');
		socket.on('subscribe',()=>{
			console.log('socket did subscribe');
			socket.join('dvpn');
			this.checkForUpdates();
		})

	}
	checkForUpdates(){
		this.updateHelper.checkForUpdates().then(data=>{
			if(Object.keys(data).length > 0){
				if(data.current != data.all[data.all.length-1]){
					this.ioNamespace.to('dvpn').emit('updatesAvailable',data);
				}
				else{
					this.ioNamespace.to('dvpn').emit('nodeIsUpToDate');
				}
			}
		})
		//this.ioNamespace.to('dvpn').emit('updatesAvailable',data);
	}
	retrieveAnalytics(){
		this.dvpnStats.getActiveSessionAnalytics().then(data=>{
			this.ioNamespace.to('dvpn').emit('sessionAnalytics',data.json,data.timeseries);
		}).catch(error=>{
			this.ioNamespace.to('dvpn').emit('sessionAnalytics',{},{});
		})
	}
	initSocketListener(room){
		//TODO: add when we get more stats on nodes..
		if(typeof this.updateCheckRoomInterval == "undefined"){
			//spin up an interval to send out stats
			this.updateCheckRoomInterval = setInterval(()=>{
				this.checkForUpdates();
			},60 * 1000 * 60); //hourly check for updates
		}
		if(typeof this.sessionAnalyticsInterval == "undefined"){
			this.sessionAnalyticsInterval = setInterval(()=>{
				this.retrieveAnalytics();
			},30*1000); //every 30s
		}

	}
	removeSocketListener(room){
		//everybody left the room, kill the update interval
		/*clearInterval(this.socketRoomInterval);
		delete this.socketRoomInterval;*/
		if(typeof this.updateCheckRoomInterval != "undefined"){
			clearInterval(this.updateCheckRoomInterval);
			delete this.updateCheckRoomInterval;
		}
		if(typeof this.sessionAnalyticsInterval != "undefined"){
			clearInterval(this.sessionAnalyticsInterval);
			delete this.sessionAnalyticsInterval;
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
				this.dvpnSetup.getConfigs(true).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
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
					this.updateHelper.updateDVPN(this.ioNamespace).then(()=>{
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
		return this.dvpnSetup.launchDVPN(parsed.pw,this.ioNamespace);
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
		return this.dvpnSetup.updateConfigs(parsed)
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