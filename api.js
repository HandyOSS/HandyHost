import {HandySia} from './HandySia.js';
import {HandyDVPN} from './HandyDvpn.js';
import {HandyAKT} from './HandyAkt.js';
import { Server } from "socket.io";

export class APIHelper{
	constructor(){
		this.sia = new HandySia();
		this.dvpn = new HandyDVPN();
		this.akt = new HandyAKT();
	}
	initSocketConnection(httpServer){
		this.io = new Server(httpServer);

		this.initSiaSockets()
		this.initDVPNSockets();	
		this.initAKTSockets();
	}

	get(requestPath,requestBody){
		return new Promise((resolve,reject)=>{
			let positional = this.filterPositional(requestPath);

			if(positional[0] == 'api'){
				console.log('is positional',positional);
				//callback(null,{pos:positional});
				this.getAPIResponse(positional,requestBody,resolve,reject);
			}
			else{
				reject('request path not valid: '+requestPath)
			}
		});
		
	}
	filterPositional(path){
		let split = path.split('/');
		return split.filter(function(d){
			if(d != '') return d;
		});
	}
	getAPIResponse(positional,requestBody,resolve,reject){
		const path = positional.slice(1,positional.length);
		switch(path[0]){
			case 'sia':
				this.sia.api(path,requestBody,resolve,reject);
			break;
			case 'dvpn':
				this.dvpn.api(path,requestBody,resolve,reject);
			break;
			case 'akt':
				this.akt.api(path,requestBody,resolve,reject);
			break;
			//todo: other services
		}
		
	}
	initSiaSockets(){
		this.sia.addSocketNamespace(this.io.of('/sia'));
	}
	initDVPNSockets(){
		this.dvpn.addSocketNamespace(this.io.of('/dvpn'));
	}
	initAKTSockets(){
		this.akt.addSocketNamespace(this.io.of('/akt'));
	}
	
}