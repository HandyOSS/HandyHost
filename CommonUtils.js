import {spawn,spawnSync} from 'child_process'; 
import fs from 'fs';
import https from 'https';
import jsonwebtoken from 'jsonwebtoken';
import crypto from 'crypto';

export class CommonUtils{
	constructor(){
		this.port = process.env.HANDYHOST_PORT || 8008;
		this.sslPort = process.env.HANDYHOST_SSL_PORT || 58008;
		this.redlistPortsPath = process.env.HOME+'/.HandyHost/ports.json';
	}
	escapeBashString(str){
		//escape strings for bash
		return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\!\|\#\&\~\"\'\`\ ]/g, "\\$&");
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
			const path = '/HandyOSS/HandyHost/master/VERSION';
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
	initKeystore(){
		if(!fs.existsSync(process.env.HOME+'/.HandyHost/keystore')){
			fs.mkdirSync(process.env.HOME+'/.HandyHost/keystore','0700');
		  	//create certs
		  	const keyPath = process.env.HOME+'/.HandyHost/keystore/handyhost.key';
		  	const pubPath = process.env.HOME+'/.HandyHost/keystore/handyhost.pub';
		  	const homebrewPrefixMAC = process.arch == 'arm64' ? '/opt/homebrew' : '/usr/local';
		  	const openssl = process.platform == 'darwin' ? homebrewPrefixMAC+'/opt/openssl@1.1/bin/openssl' : 'openssl';
		  	const create = spawn(openssl,['genrsa', '-out', keyPath, '4096']);
		  	create.on('close',()=>{
		  		const createPub = spawn(openssl,['rsa', '-in', keyPath, '-pubout', '-out', pubPath])
		  		createPub.on('close',()=>{
		  			fs.chmodSync(keyPath,'0600');
		  			fs.chmodSync(pubPath,'0644');

		  		})
		  	})
		}
	}
	encrypt(value,isForDaemon,daemonServiceName){
		return new Promise((resolve,reject)=>{
			
			const pubKeyName = isForDaemon ? 'daemon.pub' : 'handyhost.pub';
			const basePath = process.env.HOME+'/.HandyHost/keystore/';
			const pubPath = basePath+pubKeyName;
			const encryptedOutPath = isForDaemon ? basePath+'daemon_'+daemonServiceName : basePath+'k'+(new Date().getTime());
			const homebrewPrefixMAC = process.arch == 'arm64' ? '/opt/homebrew' : '/usr/local';
		  	const openssl = process.platform == 'darwin' ? homebrewPrefixMAC+'/opt/openssl@1.1/bin/openssl' : 'openssl';
			const args = ['rsautl', '-pubin', '-inkey', pubPath, '-encrypt', '-pkcs','-out',encryptedOutPath];
			
			const enc = spawn(openssl,args)
			enc.stdin.write(`${value}`);
			let resp = '';
			enc.stdout.on('data',d=>{
				//console.log('stdout',d.toString());
				resp += d.toString();
			})
			enc.stderr.on('data',d=>{
				console.log('stderr',d.toString());
			})
			enc.on('close',()=>{
				
				fs.chmodSync(encryptedOutPath,'0600');
				resolve(encryptedOutPath)
			})
			enc.stdin.end();
		});
	}
	decrypt(encpath,isDaemon){
		return new Promise((resolve,reject)=>{
			const keyPath = process.env.HOME+'/.HandyHost/keystore/handyhost.key';
			const homebrewPrefixMAC = process.arch == 'arm64' ? '/opt/homebrew' : '/usr/local';
		  	const openssl = process.platform == 'darwin' ? homebrewPrefixMAC+'/opt/openssl@1.1/bin/openssl' : 'openssl';
		  	const dec = spawn(openssl,['rsautl','-inkey',keyPath, '-decrypt', '-in', encpath]);
			let out = '';
			dec.stdout.on('data',d=>{
				out += d.toString();
			})
			dec.on('close',()=>{
				if(!isDaemon){
					fs.unlinkSync(encpath);
				}
				if(out.length > 0){
					if(out[out.length-1] == '\n'){
						//in some cases can add a newline to end of string...
						//and the gui doesnt allow newlines in fields
						out = out.slice(0,-1);
					}
				}
				resolve(out);
			})
		})
	}
	getDarwinKeychainPW(serviceName){
		return new Promise((resolve,reject)=>{
			const getpw = spawn('security',['find-generic-password','-s',serviceName,'-a',process.env.USER,'-w']);
			let exists = true;
			getpw.stderr.on('data',d=>{
				console.log('err',d.toString());
				exists = false;
			});
			let out = '';
			getpw.stdout.on('data',d=>{
				out += d.toString();
			})
			getpw.on('close',()=>{
				resolve({
					exists,
					value:out.trim()
				});
			})
		})
		

	}
	setDarwinKeychainPW(pw,serviceName){
		const getpw = spawn('security',['find-generic-password','-a',process.env.USER,'-s',serviceName,'-w']);
		let exists = true;
		getpw.stderr.on('data',d=>{
			exists = false;
		})
		getpw.on('close',()=>{
			if(!exists){
				spawn('security',['add-generic-password','-a',process.env.USER,'-s',serviceName, '-w',pw])
			}
			else{
				const del = spawn('security',['delete-generic-password','-a',process.env.USER,'-s',serviceName]);
				del.on('close',()=>{
					spawn('security',['add-generic-password','-a',process.env.USER,'-s',serviceName, '-w',pw])
				})
			}
		})
		
				
	}
					
	encryptToBase64(value){
		return new Promise((resolve,reject)=>{
			const basePath = process.env.HOME+'/.HandyHost/keystore/';
			const encryptedOutPath = basePath+'temp'+(new Date().getTime());
			const homebrewPrefixMAC = process.arch == 'arm64' ? '/opt/homebrew' : '/usr/local';
		  	const openssl = process.platform == 'darwin' ? homebrewPrefixMAC+'/opt/openssl@1.1/bin/openssl' : 'openssl';
			const enc = spawn(openssl,['rsautl','-pubin','-inkey',process.env.HOME+'/.HandyHost/keystore/daemon.pub', '-encrypt','-pkcs']);
			const toBase64 = spawn(openssl,['enc','-base64']);
			enc.stdin.write(`${value}`);
			enc.stdin.end();
			enc.stdout.pipe(toBase64.stdin);
			
			let out = '';
			toBase64.stdout.on('data',d=>{
				out += d.toString();
			})

			toBase64.on('close',()=>{
				resolve(out);
			})
			
		})
	}
	
	initJWTKey(){
		const jwtPath = process.env.HOME+'/.HandyHost/keystore/jwt.key';
		if(!fs.existsSync(jwtPath)){
			fs.writeFileSync(jwtPath,crypto.createHash('sha256').update( (Math.floor(new Date().getTime()*Math.random()) - Math.floor(Math.random()*new Date().getTime())).toString() ).digest('hex'),'utf8');
		}
		const authPath = process.env.HOME+'/.HandyHost/keystore/auth.key';
		if(!fs.existsSync(authPath)){
			//set a default
			fs.writeFileSync(authPath,crypto.createHash('sha256').update('changemeplease').digest('hex'),'utf8');
		}
		
	}
	hasDefaultAuth(){
		const authPath = process.env.HOME+'/.HandyHost/keystore/auth.key';
		const defaultPass = crypto.createHash('sha256').update('changemeplease').digest('hex');
		const currentPass = fs.readFileSync(authPath,'utf8').trim();
		return defaultPass == currentPass;
	}
	checkAuth(pw){
		return new Promise((resolve,reject)=>{
			const authPath = process.env.HOME+'/.HandyHost/keystore/auth.key';
			const auth = fs.readFileSync(authPath,'utf8').trim();
			if(auth != pw){
				resolve(false);
			}
			else{
				resolve(true);
			}
		});
	}
	changeAuth(newPass,oldPass){
		return new Promise((resolve,reject)=>{
			const authPath = process.env.HOME+'/.HandyHost/keystore/auth.key';
			const defaultPass = crypto.createHash('sha256').update('changemeplease').digest('hex');
			const currentPass = fs.readFileSync(authPath,'utf8').trim();
			if(currentPass == defaultPass){
				//is default/brand new, change it
				fs.writeFileSync(authPath,newPass,'utf8');
				resolve(true);
			}
			else{
				if(oldPass == currentPass){
					//do change
					fs.writeFileSync(authPath,newPass,'utf8');
					resolve(true);
				}
				else{
					resolve(false);
				}
			}
		});
	}
	checkAuthToken(token){
		const jwtKey = fs.readFileSync(process.env.HOME+'/.HandyHost/keystore/jwt.key','utf8').trim();
		let verified = false;
		try{
			verified = jsonwebtoken.verify(token, jwtKey);
		}
		catch(e){
			verified = false;
		}
		return verified;
	}
	bumpToken(){
		return new Promise((resolve,reject)=>{
			const jwtKey = fs.readFileSync(process.env.HOME+'/.HandyHost/keystore/jwt.key','utf8').trim();
			const data = {
		        timestamp:new Date().getTime()
		    }
		    const token = jsonwebtoken.sign(data, jwtKey, { expiresIn: '30d' }); //likely their browser sesh will last 30 days..
	        resolve(token);
		});
		
	}
}