import fs from 'fs';
import path from 'path';
import url from 'url';
import {spawn} from 'child_process';

export class HandyAKT{
	constructor(){
		
		/*
		create any env variables on machine restart. Sia needs them so possibly others..
		try{
			fs.mkdirSync(`${process.env.HOME}/.HandyHost/aktData`,{recursive:true})
		}
		catch(e){
			//folder already exists
		}
		let acctName;
		try{
			acctName = fs.readFileSync(`${process.env.HOME}/.HandyHost/aktData/.nodeEnv`,'utf8');
		}
		catch(e){}
		
		if(typeof acctName != "undefined"){
			process.env.AKT_ACCT_NAME = acctName.replace(/\n/g,'');
			//try startup here since we have already inited
		}
		*/
	}
	addSocketNamespace(ioNamespace){
		//this.io.of('/dvpn')
		console.log('init akt sockets');
		this.ioNamespace = ioNamespace;
		this.ioNamespace.adapter.on("create-room", (room) => {
		  if(room.indexOf('akt') == 0){
		  	//start a Socket listener for this room
		  	this.initSocketListener(room);
		  }
		});

		this.ioNamespace.adapter.on("delete-room", (room) => {
		  console.log(`room deleted ${room}`);
		  if(room.indexOf('akt') == 0){
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
		console.log('setup connection events');
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
			socket.join('akt');
		})

	}
	initSocketListener(room){
		//TODO: add when we get more stats on nodes..
		/*if(typeof this.socketRoomInterval == "undefined"){
			//spin up an interval to send out stats
			this.socketRoomInterval = setInterval(()=>{
				this.sendSocketUpdates();
			},60000);
		}*/
	}
	removeSocketListener(room){
		//everybody left the room, kill the update interval
		/*clearInterval(this.socketRoomInterval);
		delete this.socketRoomInterval;*/
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
			/*
			//example: a request for /api/dvpn/getState::
			case 'getState':
				//check if its installed
				this.dvpnSetup.getState().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;*/
			
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