import {spawn} from 'child_process'; 
import fs from 'fs';
import https from 'https';

export class CommonUtils{
	constructor(){
		this.port = process.env.HANDYHOST_PORT || 8008;
		this.sslPort = process.env.HANDYHOST_SSL_PORT || 58008;
		this.redlistPortsPath = process.env.HOME+'/.HandyHost/ports.json';
	}
	escapeBashString(str){
		//escape strings for bash
		return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|\#\&\~\"\'\`\ ]/g, "\\$&");
	}
	getSafePort(interimPorts){
		//get a random port outside of the range that may be used in the services
		//for config generation, mainly in dvpn
		const interim = typeof interimPorts == "undefined" ? [] : interimPorts;
		let ports = {}
		if(fs.existsSync(this.redlistPortsPath)){
			ports = JSON.parse(fs.readFileSync(this.redlistPortsPath,'utf8'));
		}
		else{
			ports = JSON.parse(fs.readFileSync('./reservedPortsDefault.json','utf8'));
		}
		return getRandomPort();
		function getRandomPort(){
			//recursively check for a free port that's not in cusrom
			const port = Math.floor((Math.random() * 19999) + 10000);
			if(typeof ports.custom[port.toString()] == "undefined" && typeof ports.default[port.toString()] == "undefined" && interim.indexOf(port) == -1){
				return port;
			}
			else{
				console.log('port was taken, try again');
				return getRandomPort();
			}
		}
	}
	getGlobalIP(){
		return new Promise((resolve,reject)=>{
			//get public IP for them at least..
			const options = {
				host: 'api.ipify.org',
				port:'443',
				path: `/`,
				method:'GET',
				rejectUnauthorized: true,
				requestCert: true,
				agent: false
			};
			let output = '';
			const request = https.request(options,response=>{
				response.on('data', (chunk) => {
					output += chunk;
				});

				//the whole response has been received, so we just print it out here
				response.on('end', () => {
					resolve({global_ip:output});
				});

				if(response.statusCode.toString() != '200'){
					//something went wrong
					console.log('error getting public ip',response.statusCode.toString());
					reject(output);
				}
			});
			request.end();
			
		})
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
			  resolve({ip:ipOut,port:this.port,sslPort:this.sslPort});
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
				console.log('starting updater','pid',process.pid,'path',process.argv.join(' '))
				const update = spawn('./update.sh',[target,process.argv.join(' '),process.pid],{env:process.env,detached:true});
				update.stdout.on('data',(d)=>{
					console.log('update stdout',d.toString());
					if(d.toString().trim() == 'restarting handyhost'){
						resolve(true);
					}
				})
				update.stderr.on('data',(d)=>{
					console.log('update stderr',d.toString());
					if(d.toString().trim() == 'restarting handyhost'){
						resolve(true);
					}
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