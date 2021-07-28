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
		siacCommand('daemon/update','GET').then(d=>{
			console.log('daemon update availability stats',d);
		}).catch(e=>{
			console.error('ERROR GETTING DAEMON UPDATE AVAIL INFO',e);
		});
	}
	updateDaemon(){
		siacCommand('daemon/update','POST').then(d=>{
			console.log('daemon updating stats',d);
		}).catch(e=>{
			console.error('ERROR GETTING DAEMON UPDATING INFO',e);
		});
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
			const appExists = fs.existsSync(siaDirectory);
			let isNewInstall = false;
			if(!appExists){
				fs.mkdirSync(siaDirectory,{recursive:true});
				isNewInstall = true;
				this.gateway = new Gateway();
			}
			console.log('start siad',siaDirectory);
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
				':9985',
				'--siamux-addr-ws',
				':9986',
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
}
