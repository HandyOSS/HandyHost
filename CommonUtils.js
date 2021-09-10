import {spawn} from 'child_process'; 
import fs from 'fs';
import https from 'https';

export class CommonUtils{
	constructor(){
		this.port = process.env.HANDYHOST_PORT || 8008;
	}
	getIPForDisplay(){
		return new Promise((resolve,reject)=>{
			let getIPCommand;
			let getIPOpts;
			let ipCommand;
			let ipOut;

			if(process.platform == 'darwin'){
			  getIPCommand = 'ipconfig';
			  getIPOpts =  ['getifaddr', 'en0'];
			}
			if(process.platform == 'linux'){
			  //hostname -I [0]
			  getIPCommand = 'hostname';
			  getIPOpts = ['-I'];
			}

			ipCommand = spawn(getIPCommand,getIPOpts); 
			ipCommand.stdout.on('data',d=>{
			  ipOut = d.toString('utf8').trim();
			});
			ipCommand.on('close',()=>{
			  if(process.platform == 'linux'){
			    ipOut = ipOut.split(' ')[0];
			  }
			  resolve({ip:ipOut,port:this.port});
			});
		});

	}
	checkForUpdates(){
		return new Promise((resolve,reject)=>{
			let host = 'raw.githubusercontent.com';
			if(typeof process.env.HANDYHOST_PRIVATE_REPO_TOKEN != "undefined"){
				host = process.env.HANDYHOST_PRIVATE_REPO_TOKEN+'@'+host;
			}
			const path = '/HandyMiner/HandyHost/master/VERSION';
			return this.queryHTTPSResponse(host,path).then(versionRepo=>{
				const localVersion = fs.readFileSync("./VERSION",'utf8').trim();
				resolve({
					latest:versionRepo,
					local:localVersion,
					isUpToDate: (localVersion == versionRepo)
				});
			}).catch(error=>{
				console.log('error checking for handyhost updates',error);
			})
		})
		
	}
	updateHandyHost(){
		return new Promise((resolve,reject)=>{
			this.checkForUpdates().then(updateData=>{
				const target = updateData.latest;
				const update = spawn('./update.sh',[target,process.argv.join(' '),process.pid],{env:process.env});
				update.stdout.on('data',(d)=>{
					console.log('update stdout',d.toString());
				})
				update.stderr.on('data',(d)=>{
					console.log('update stderr',d.toString());
				})
				update.on('close',()=>{
					console.log('done with update');
					resolve(true);
				})
			})
		});
	}
	queryHTTPSResponse(host,path){
		return new Promise((resolve,reject)=>{
			let RESP = '';
			const request = https.request('https://'+host+path,response=>{
				//another chunk of data has been received, so append it to `str`
				
				response.on('data', (chunk) => {
					RESP += chunk.toString().replace(/\n/gi,'').trim();
				});

				//the whole response has been received, so we just print it out here
				response.on('end', () => {
					
					resolve(RESP)
					
				});

				if(response.statusCode.toString() != '200'){
					//something went wrong
					reject(response.statusCode.toString());
				}
			});
			request.on('error',e=>{
				console.log('error w request',e);
				reject(e);
			})
			request.end();
		})
	}
}