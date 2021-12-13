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
				if(typeof process.env.HANDYHOST_TEST_BRANCH != "undefined"){
					versionRepo = process.env.HANDYHOST_TEST_BRANCH;
				}
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
	checkForM1RosettaFun(){
		//check if this is running in macos rosetta, nice.
		return new Promise((resolve,reject)=>{
			if(process.platform != 'darwin'){
				resolve(false);
				return;
			}

			const s = spawn('sysctl', ['sysctl.proc_translated']);
			let out = '';
			s.stdout.on('data',d=>{
				out += d.toString();
			})
			s.on('close',()=>{
				let o = out.split(':');
				o = o[o.length-1];
				if(o.trim() == '1'){
					//is fn arm64
					resolve(true);
				}
				else{
					if(process.arch == 'arm64'){
						resolve(true);
					}
					resolve(false);
				}
			})
		})
		
	}
	initKeystore(){
		if(!fs.existsSync(process.env.HOME+'/.HandyHost/keystore')){
			fs.mkdirSync(process.env.HOME+'/.HandyHost/keystore','0700');
		  	//create certs
		  	const keyPath = process.env.HOME+'/.HandyHost/keystore/handyhost.key';
		  	const pubPath = process.env.HOME+'/.HandyHost/keystore/handyhost.pub';
		  	this.checkForM1RosettaFun().then(isRosetta=>{
		  		const homebrewPrefixMAC = isRosetta ? '/opt/homebrew' : '/usr/local';
			  	const openssl = process.platform == 'darwin' ? homebrewPrefixMAC+'/opt/openssl@1.1/bin/openssl' : 'openssl';
			  	const create = spawn(openssl,['genrsa', '-out', keyPath, '4096']);
			  	create.on('close',()=>{
			  		const createPub = spawn(openssl,['rsa', '-in', keyPath, '-pubout', '-out', pubPath])
			  		createPub.on('close',()=>{
			  			fs.chmodSync(keyPath,'0600');
			  			fs.chmodSync(pubPath,'0644');

			  		})
			  	})
		  	});
		  	
		}
	}
	encrypt(value,isForDaemon,daemonServiceName,isForHealthcheck){
		return new Promise((resolve,reject)=>{
			
			const pubKeyName = isForDaemon ? ( isForHealthcheck ? 'handyhost.pub' : 'daemon.pub' ) : 'handyhost.pub';
			const basePath = process.env.HOME+'/.HandyHost/keystore/';
			const pubPath = basePath+pubKeyName;
			const encryptedOutPath = isForDaemon ? basePath+'daemon_'+daemonServiceName : basePath+'k'+(new Date().getTime());
			this.checkForM1RosettaFun().then(isRosetta=>{
				const homebrewPrefixMAC = isRosetta ? '/opt/homebrew' : '/usr/local';
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
		});
	}
	decrypt(encpath,isDaemon){
		return new Promise((resolve,reject)=>{
			const keyPath = process.env.HOME+'/.HandyHost/keystore/handyhost.key';
			this.checkForM1RosettaFun().then(isRosetta=>{
		  		const homebrewPrefixMAC = isRosetta ? '/opt/homebrew' : '/usr/local';
				//const homebrewPrefixMAC = process.arch == 'arm64' ? '/opt/homebrew' : '/usr/local';
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
			});
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
			this.checkForM1RosettaFun().then(isRosetta=>{
		  		const homebrewPrefixMAC = isRosetta ? '/opt/homebrew' : '/usr/local';
				//const homebrewPrefixMAC = process.arch == 'arm64' ? '/opt/homebrew' : '/usr/local';
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
			});
			
		})
	}
	isAuthEnabled(){
		//check if auth is enabled
		return true; //enable auth always
		const settingsPath = process.env.HOME+'/.HandyHost/authSettings.json';
		let isEnabled = false;
		if(fs.existsSync(settingsPath)){
			let settings = {};
			try{
				settings = JSON.parse(fs.readFileSync(settingsPath,'utf8'));
			}
			catch(e){
				console.log("ERROR PARSING DEFAULT AUTH FILE AT "+settingsPath,e);
			}
			isEnabled = typeof settings.enabled != "undefined" ? settings.enabled : isEnabled;
		}
		return isEnabled;
	}
	getAuthDefaultExpiry(){
		const settingsPath = process.env.HOME+'/.HandyHost/authSettings.json';
		let expiry = '30d';
		if(fs.existsSync(settingsPath)){
			let settings = {};
			try{
				settings = JSON.parse(fs.readFileSync(settingsPath,'utf8'));
			}
			catch(e){
				console.log("ERROR PARSING DEFAULT AUTH FILE AT "+settingsPath,e);
			}
			expiry = typeof settings.tokenTTL != "undefined" ? settings.tokenTTL : expiry;
		}
		return expiry;
	}
	initJWTKey(){
		const jwtPath = process.env.HOME+'/.HandyHost/keystore/jwt.key';
		const authPath = process.env.HOME+'/.HandyHost/keystore/auth.key';
		const settingsPath = process.env.HOME+'/.HandyHost/authSettings.json';
		
		const jwtKeyDefault = crypto.createHash('sha256').update( (Math.floor(new Date().getTime()*Math.random()) - Math.floor(Math.random()*new Date().getTime())).toString() ).digest('hex');
		const defaultKey = crypto.createHash('sha256').update('changemeplease').update(jwtKeyDefault).digest('hex');
		
		if(!fs.existsSync(jwtPath)){
			//init jwt key it it doesnt exist
			fs.writeFileSync(jwtPath,jwtKeyDefault,'utf8');
		}
		if(!fs.existsSync(authPath)){
			//set a default password
			fs.writeFileSync(authPath,defaultKey,'utf8');
		}
		if(!fs.existsSync(settingsPath)){
			//init default settings
			const settings = {
				enabled:true,
				initialPassword:'changemeplease',
				hasInitialized:false,
				tokenTTL:'30d'
			}
			fs.writeFileSync(settingsPath,JSON.stringify(settings,null,2),'utf8');
		}
		else{
			//settings exist, check if auth is enabled or needs enabled
			let settings = JSON.parse(fs.readFileSync(settingsPath,'utf8'));
			//enable auth always
			if(/*settings.enabled && */!settings.hasInitialized){
				fs.writeFileSync(jwtPath,jwtKeyDefault,'utf8'); //bounce the jwtKey in case we were trying to lock out other users
				const jwtKey = fs.readFileSync(jwtPath,'utf8').trim();
				//somebody just turned on auth, lets enable it
				const initialKey = crypto.createHash('sha256').update(settings.initialPassword).update(jwtKey).digest('hex');
				fs.writeFileSync(authPath,initialKey,'utf8');
				settings.hasInitialized = true;
				fs.writeFileSync(settingsPath,JSON.stringify(settings,null,2),'utf8')
			}
		}
		
	}
	hasDefaultAuth(){
		const authPath = process.env.HOME+'/.HandyHost/keystore/auth.key';
		const jwtPath = process.env.HOME+'/.HandyHost/keystore/jwt.key';
		const jwtKey = fs.readFileSync(jwtPath,'utf8').trim();
		const settingsPath = process.env.HOME+'/.HandyHost/authSettings.json';
		let defaultpw = 'changemeplease';
		if(fs.existsSync(settingsPath)){
			let settings = {};
			try{
				settings = JSON.parse(fs.readFileSync(settingsPath,'utf8'));
			}
			catch(e){
				console.log("ERROR PARSING DEFAULT AUTH FILE AT "+settingsPath,e);
			}
			defaultpw = typeof settings.initialPassword != "undefined" ? settings.initialPassword : defaultpw;
		}
		const defaultPass = crypto.createHash('sha256').update(defaultpw).update(jwtKey).digest('hex');
		const currentPass = fs.readFileSync(authPath,'utf8').trim();
		return defaultPass == currentPass;
	}
	checkAuth(pw){
		return new Promise((resolve,reject)=>{
			const authPath = process.env.HOME+'/.HandyHost/keystore/auth.key';
			const jwtPath = process.env.HOME+'/.HandyHost/keystore/jwt.key';
			const jwtKey = fs.readFileSync(jwtPath,'utf8').trim();
			const auth = fs.readFileSync(authPath,'utf8').trim();
			const pwHashed = crypto.createHash('sha256').update(pw).update(jwtKey).digest('hex');
			if(auth != pwHashed){
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
			const jwtPath = process.env.HOME+'/.HandyHost/keystore/jwt.key';
			const jwtKey = fs.readFileSync(jwtPath,'utf8').trim();
			const settingsPath = process.env.HOME+'/.HandyHost/authSettings.json';
			let defaultpw = 'changemeplease';
			if(fs.existsSync(settingsPath)){
				let settings = {};
				try{
					settings = JSON.parse(fs.readFileSync(settingsPath,'utf8'));
				}
				catch(e){
					console.log("ERROR PARSING DEFAULT AUTH FILE AT "+settingsPath,e);
				}
				defaultpw = typeof settings.initialPassword != "undefined" ? settings.initialPassword : defaultpw;
			}
			const defaultPass = crypto.createHash('sha256').update(defaultpw).update(jwtKey).digest('hex');
			const currentPass = fs.readFileSync(authPath,'utf8').trim();
			const newPassHashed = crypto.createHash('sha256').update(newPass).update(jwtKey).digest('hex');
			const oldPassHashed = crypto.createHash('sha256').update(oldPass).update(jwtKey).digest('hex');
			if(currentPass == defaultPass){
				//is default/brand new, change it
				fs.writeFileSync(authPath,newPassHashed,'utf8');
				resolve(true);
			}
			else{
				if(oldPassHashed == currentPass){
					//do change
					fs.writeFileSync(authPath,newPassHashed,'utf8');
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
		    const tokenTTL = this.getAuthDefaultExpiry();
		    const token = jsonwebtoken.sign(data, jwtKey, { expiresIn: tokenTTL }); //likely their browser sesh will last 30 days..
	        resolve(token);
		});
		
	}
}