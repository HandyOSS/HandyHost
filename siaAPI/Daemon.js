import {siacCommand, siacPostDataCommand} from './helper.js';
import {Gateway} from './Gateway.js';
import {spawn} from 'child_process';
import fs from 'fs';

export class Daemon{
	constructor(){

	}
	getAlerts(){
		siacCommand('daemon/alerts','GET').then(d=>{
			console.log('daemon alerts stats',d);
		}).catch(e=>{
			console.error('ERROR GETTING DAEMON ALERTS INFO',e);
		});
	}
	getConstants(){
		siacCommand('daemon/constants','GET').then(d=>{
			console.log('daemon constants stats',d);
		}).catch(e=>{
			console.error('ERROR GETTING DAEMON CONSTANTS INFO',e);
		});
	}
	getSettings(){
		siacCommand('daemon/settings','GET').then(d=>{
			console.log('daemon settings stats',d);
		}).catch(e=>{
			console.error('ERROR GETTING DAEMON SETTINGS INFO',e);
		});
	}
	modifySettings(maxDownloadSpeed,maxUploadSpeed){
		//bytes per second
		siacPostDataCommand('daemon/settings',`maxdownloadspeed=${maxDownloadSpeed}&maxuploadspeed=${maxUploadSpeed}`).then(d=>{
			console.log('modified daemon settings',d);
		}).catch(e=>{
			console.error('ERROR MODIFYING DAEMON SETTINGS',e);
		});
	}
	stop(){
		return new Promise((resolve,reject)=>{
			const siac = spawn('siac',['stop']);
			siac.stderr.on('data',(e)=>{
				reject(e);
			})
			siac.on('close',()=>{
				setTimeout(()=>{
					resolve();
				},4000);
				
			})
		})
		/*return siacCommand('daemon/stop','GET',true).then(d=>{
			console.log('daemon stopped',d);
		}).catch(e=>{
			console.error('ERROR STOPPING DAEMON INFO',e);
		});*/
	}
	getUpdateAvailStatus(){
		return siacCommand('daemon/update','GET')/*.then(d=>{
			console.log('daemon update availability stats',d);
		}).catch(e=>{
			console.error('ERROR GETTING DAEMON UPDATE AVAIL INFO',e);
		});*/
	}
	updateDaemon(){
		return siacCommand('daemon/update','POST')/*.then(d=>{
			console.log('daemon updating stats',d);
		}).catch(e=>{
			console.error('ERROR GETTING DAEMON UPDATING INFO',e);
		});*/
	}
	getVersion(){
		return siacCommand('daemon/version','GET');/*.then(d=>{
			console.log('daemon version stats',d);
		}).catch(e=>{
			console.error('ERROR GETTING DAEMON VERSION INFO',e);
		});*/
	}
	siadSpawn(){
		return new Promise((resolve,reject)=>{

			const siaDirectory = `${process.env.HOME}/.HandyHost/siaData`;
			const siaPortsPath = siaDirectory + '/siaPorts.json';
			let ports = {};
			const appExists = fs.existsSync(siaDirectory);
			let isNewInstall = false;
			if(!appExists){
				fs.mkdirSync(siaDirectory,{recursive:true});
				isNewInstall = true;
				this.gateway = new Gateway();
			}
			let muxPort = ':9983';
			let muxWSPort = ':9984';
			let hostPort = ':9982';
			let rpcPort = ':9981';

			if(fs.existsSync(siaPortsPath)){
				ports = JSON.parse(fs.readFileSync(siaPortsPath,'utf8'));
				if(typeof ports.mux != "undefined"){
					muxPort = ':'+ports.mux;
				}
				if(typeof ports.host != "undefined"){
					hostPort = ':'+ports.host;
				}
				if(typeof ports.muxWS != "undefined"){
					muxWSPort = ':'+ports.muxWS;
				}
				if(typeof ports.rpc != "undefined"){
					rpcPort = ':'+ports.rpc;
				}
			}
			console.log('start siad',siaDirectory);
			console.log('hostPort',hostPort);
			console.log('rpcPort',rpcPort);
			console.log('muxPort',muxPort);
			console.log('muxWSPort',muxWSPort);
			//start siad
			const opts = {
				detached:true
			}
			if (process.geteuid) {
				opts.uid = process.geteuid()
			}
			opts.env = process.env;
			
			const logOutputPath = `${siaDirectory}/siad-output.log`;
			const siadOutputStdout = fs.openSync(logOutputPath,'a');
			const siadOutputStderr = fs.openSync(logOutputPath,'a');
			opts.stdio = ['ignore',siadOutputStdout,siadOutputStderr];
			
			const siadCLIOpts = [
				'--siamux-addr',
				muxPort,//':9985',
				'--siamux-addr-ws',
				muxWSPort,//':9986',
				'--host-addr',
				hostPort,
				'--rpc-addr',
				rpcPort,
				'--sia-directory',
				siaDirectory,
				'-M',
				'gctwhr'
			];
			const siad = spawn('siad',siadCLIOpts,opts);
			/*siad.stdout.pipe(siadOutput);
			siad.stderr.pipe(siadOutput);*/
			siad.unref();

			let didResolve = false;
			let to = setTimeout(()=>{
				if(isNewInstall){
					this.gateway.addSeeds();
				}
				resolve();
				didResolve = true;
			},2000);
			siad.on('close',()=>{
				if(!didResolve){
					clearTimeout(to);
					didResolve = true;
					reject();
				}
			})

		});
		
	}
	haltSiad(){
		return new Promise((resolve,reject)=>{
			const siac = spawn('siac',['stop']);
			siac.stdout.on('data',d=>{
				console.log('siac stopping stdout: ',d.toString());
			})
			siac.stderr.on('data',d=>{
				console.log('siac stopping stderr: ',d.toString());
			})
			siac.on('close',()=>{

				setTimeout(()=>{
					//sometimes siad process hangs open forever. 
					//kill it manually then
					const pkill = spawn('pkill',['-f','siad']);
					pkill.stdout.on('data',d=>{
						console.log('pkill out',d.toString());
					});
					pkill.stderr.on('data',d=>{
						console.log('pkill err',d.toString());
					})
					pkill.on('close',()=>{
						setTimeout(()=>{
							resolve(); //finally done
						},5000)
					})
					
				},5000); //give it time to shut down
			})
		})
	}
}
