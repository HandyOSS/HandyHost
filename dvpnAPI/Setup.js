import fs from 'fs';
import {spawn} from 'child_process';
import https from 'https';
import http from 'http';
import generator from 'project-name-generator';
import {CommonUtils} from '../CommonUtils.js';

export class DVPNSetup{
	constructor(){
		this.redlistPortsPath = process.env.HOME+'/.HandyHost/ports.json';
		this.utils = new CommonUtils();
	}
	
	initWallet(pw,walletName){
		return new Promise((resolve,reject)=>{
		
			//const args = ['./dvpnAPI/addNewKey.sh',pwLoc,this.utils.escapeBashString(walletName)];
			let output = '';
			let stderrOutput = '';
			
			const args = [
				'run', 
				'--rm',
				'--interactive',
				'--volume', `${process.env.HOME}/.sentinelnode:/root/.sentinelnode`,
				'sentinel-dvpn-node', 'process', 'keys', 'add', this.utils.escapeBashString(walletName)
			];

			const s = spawn('docker',args,{shell:true,env:process.env,cwd:process.env.PWD});
			s.stdin.write(`${this.utils.escapeBashString(pw)}\n`)
			s.stdin.write(`${this.utils.escapeBashString(pw)}\n`)
			//const s = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD});
			//s.stdin.write('(echo derparoo;)');
			s.stdout.on('data',d=>{
				output += d.toString();
			})
			s.stderr.on('data',d=>{
			    //console.log('stderr',d.toString());
			    //reject({'error':d.toString()})
			    stderrOutput += d.toString();
			})
			s.stdin.end();
			s.on('close',d=>{
				if(stderrOutput.indexOf('mnemonic') == -1 && stderrOutput.indexOf('address') == -1 && stderrOutput.indexOf('operator') == -1){
					reject({error:stderrOutput})
					return;
				}

			    this.finishWalletInit(output,stderrOutput,walletName,false,resolve);
			})
		
		});
	}
	initWalletFromSeed(seed,pw,walletName){
		return new Promise((resolve,reject)=>{
				//const args = ['./dvpnAPI/recoverKey.sh',seedLoc,pwLoc,this.utils.escapeBashString(walletName)];
				let output = '';
				let stderrOutput = '';
				
				const args = [
					'run', 
					'--rm',
					'--interactive',
					'--volume', `${process.env.HOME}/.sentinelnode:/root/.sentinelnode`,
					'sentinel-dvpn-node', 'process', 'keys', 'add', this.utils.escapeBashString(walletName), 
					'--recover'
				];
				
				const s = spawn('docker',args,{shell:true,env:process.env,cwd:process.env.PWD})
				s.stdin.write(`${seed}\n`);
				s.stdin.write(`${this.utils.escapeBashString(pw)}\n`);
				s.stdin.write(`${this.utils.escapeBashString(pw)}\n`);
				//const s = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD});
				s.stdout.on('data',d=>{
					output += d.toString();
				    //console.log('stdout',d.toString());
				})
				s.stderr.on('data',d=>{
				    //console.log('stderr',d.toString());
				    stderrOutput += d.toString();
				    //reject({'error':d.toString()})
				})
				s.stdin.end();
				s.on('close',d=>{
				    if(stderrOutput.indexOf('mnemonic') == -1 && stderrOutput.indexOf('address') == -1 && stderrOutput.indexOf('operator') == -1){
						reject({error:stderrOutput})
						return;
					}
				    this.finishWalletInit(output,stderrOutput,walletName,true,resolve);
				})
			
			
		});
	}
	finishWalletInit(output,stderrOutput,walletName,isInitFromSeed,resolve){
		const outputData = {};
		stderrOutput.split('\n').filter(d=>{
	    	return d.length > 0;
	    }).map(rec=>{
	    	let parts = rec.split(':');
	    	if(parts.length > 1){
	    		const key = parts[0].trim().toLowerCase();
	    		if(!isInitFromSeed){
	    			outputData[key] = parts[1].trim();
	    		}
	    		else{
	    			if(key != 'mnemonic'){
	    				outputData[key] = parts[1].trim();
	    			}
	    		}
	    	}
	    })
	    if(!isInitFromSeed){
	    	//get mnemonic from stderr
			let lines = stderrOutput.split('\n').filter(line=>{
				return line.length > 0;
			});
			outputData.mnemonic = lines[lines.length-1].trim();
			
	    }
	    if(typeof outputData.operator != "undefined"){
	    	//write latest address to file so we can check balance later for dashboard stats
	    	fs.writeFileSync(`${process.env.HOME}/.HandyHost/sentinelData/.operator`,outputData.operator,'utf8');
	    }
	    fs.writeFileSync(`${process.env.HOME}/.HandyHost/sentinelData/.nodeEnv`,walletName,'utf8');
	    process.env.DVPN_ACCT_NAME = walletName;
	    const newConfigParam = {
	    	node:{
	    		keyring:{
	    			from:`"${walletName}"`
	    		}
	    	}
	    };
	    
	    this.updateConfigs(newConfigParam).then(d=>{
	    	resolve(outputData);
	    });
	}
	initConfigs(){
		//if configs dont exist lets init them
		return new Promise((resolve,reject)=>{
			if(fs.existsSync(`${process.env.HOME}/.sentinelnode/config.toml`)){
				resolve({exists:true});
				return;
			}

			let args = ['./dvpnAPI/initConfigs.sh'];
			if(process.platform == 'darwin'){
				args = ['./dvpnAPI/initConfigsMAC.sh'];
			}
			let output = '';
			const s = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD});
			//s.stdin.write('(echo derparoo;)');
			s.stdout.on('data',d=>{
				output += d.toString();
			    console.log('stdout',d.toString());
			})
			s.stderr.on('data',d=>{
			    console.log('stderr',d.toString());
			    reject({'error':d.toString()})
			})
			s.on('close',d=>{
			    //console.log('spawn closed',d);
			    //1.1.0rc0 dvpn-node requires from and price to be set in order to init wallets now.
			    const port = this.utils.getSafePort();
			    const port2 = this.utils.getSafePort([port]);
			    let globalIP = '0.0.0.0';
			    this.utils.getGlobalIP().then(ipData=>{
			    	globalIP = ipData.global_ip;
			    	finish();
			    }).catch(e=>{
			    	finish();
			    });
			    const _this = this;
			    function finish(){
			    	const newConfigParam = {
				    	node:{
				    		chain:{
				    			id:'sentinelhub-2'
				    		},
				    		keyring:{
				    			from:`"__default__"`
				    		},
				    		node:{
				    			remote_url:'https://'+globalIP+':'+port,
				    			listen_on:globalIP+':'+port,
				    			moniker: generator({words: 3}).dashed,
				    			price: '1000000udvpn'
				    		}
				    	},
				    	wireguard:{
				    		listen_port:port2
				    	}
				    };
				    _this.updateConfigs(newConfigParam);
				    resolve({exists:true});
			    }
			    

			})
		});
	}
	getConfigs(filterConfig){
		
		return new Promise((resolve,reject)=>{
			const nodeConfig = fs.readFileSync(`${process.env.HOME}/.sentinelnode/config.toml`,'utf8');
			const wgConfig = fs.readFileSync(`${process.env.HOME}/.sentinelnode/wireguard.toml`,'utf8');
			//console.log('config',wgConfig);
			const nodeParsed = this.parseConfigFile(nodeConfig,filterConfig);
			const wgParsed = this.parseConfigFile(wgConfig,filterConfig);
			//console.log('parsed',wgParsed);
			resolve({
				node:nodeParsed,
				wireguard:wgParsed
			})
		}).catch(e=>{
			console.log('error',e);
		})
	}
	getPorts(){
		return new Promise((resolve,reject)=>{
			this.getConfigs().then(data=>{
				let listen = data.node.node.listen_on.value;
				let wg = data.wireguard.listen_port.value;
				listen = listen.split(':');
				listen = listen[listen.length-1].trim();
				resolve({
					node:listen,
					wireguard:wg
				})
			})
		})
	}
	updateConfigs(newConfigData){
		return new Promise((resolve,reject)=>{
			this.getConfigs().then(configJSON=>{
				let updatedConfig = configJSON;
				Object.keys(newConfigData).map(tlKey=>{
					let ogItem = updatedConfig[tlKey];
					//console.log('ogItem',tlKey,ogItem,newConfigData[tlKey]);
					if(ogItem.leaf){
						//update the value then
						updatedConfig[tlKey].value = newConfigData[tlKey];
					}
					else{
						Object.keys(newConfigData[tlKey]).map(secondLevelKey=>{
							//console.log("L2 KEY",secondLevelKey);
							if(typeof updatedConfig[tlKey][secondLevelKey] != "undefined"){
								if(updatedConfig[tlKey][secondLevelKey].leaf){
									//is leaf
									updatedConfig[tlKey][secondLevelKey].value = newConfigData[tlKey][secondLevelKey];
								}
								else{
									Object.keys(newConfigData[tlKey][secondLevelKey]).map(key=>{
										//console.log('L3 KEY',key);
										if(typeof updatedConfig[tlKey][secondLevelKey][key] != "undefined"){
											updatedConfig[tlKey][secondLevelKey][key].value = newConfigData[tlKey][secondLevelKey][key];
										}
										
									})
								}
								
							}
							
						})
					}
				});
				//config is now merged, now output some config.toml
				let tomls = {
					node:'',
					wireguard:''
				}
				//console.log('did update?',JSON.stringify(updatedConfig,null,2));
				Object.keys(updatedConfig).map(fileKey=>{
					Object.keys(updatedConfig[fileKey]).map(key=>{
						if(updatedConfig[fileKey][key].leaf){
							//its prob wireguard or top level conf with no nesting
							updatedConfig[fileKey][key].value = checkString(updatedConfig[fileKey][key]);
							tomls[fileKey] += `${key} = ${updatedConfig[fileKey][key].value}\n`
						}
						else{
							tomls[fileKey] += `[${key}]\n`;
							Object.keys(updatedConfig[fileKey][key]).map(secondLevelKey=>{
								tomls[fileKey] += `${secondLevelKey} = ${checkString(updatedConfig[fileKey][key][secondLevelKey])}\n`
							})
						}
					})
				});
				fs.writeFileSync(`${process.env.HOME}/.sentinelnode/config.toml`,tomls.node,'utf8');
				fs.writeFileSync(`${process.env.HOME}/.sentinelnode/wireguard.toml`,tomls.wireguard,'utf8');
				this.updateRedlistPorts();
				resolve({success:true})
			})
		});
		function checkString(obj){
			if(obj.type == 'string'){
				if(obj.value.indexOf('"') == -1){
					return `"${obj.value}"`
				}
			}
			return obj.value;
		}
	}
	updateRedlistPorts(){
		if(fs.existsSync(this.redlistPortsPath)){
			let redlist = JSON.parse(fs.readFileSync(this.redlistPortsPath,'utf8'));
			this.getPorts().then(ports=>{
				const node = ports.node;
				const wg = ports.wireguard;
				//first cleanup redlist custom ports
				Object.keys(redlist.custom).map(port=>{
					const d = redlist.custom[port];
					if(d.service == 'DVPN'){
						delete redlist.custom[port];
					}
				});
				redlist.custom[node] = {
					"description":"DVPN node port",
					"service":"DVPN"
				}
				redlist.custom[wg] = {
					"description":"DVPN wireguard port",
					"service":"DVPN"
				}
				fs.writeFileSync(this.redlistPortsPath,JSON.stringify(redlist,null,2),'utf8');
			})
		}
		
	}
	getKeyList(pw){
		return new Promise((resolve,reject)=>{
			//const args = ['./dvpnAPI/listKeys.sh',pwLoc];
			let output = '';
			const args = [
				'run', '--rm',
				'--interactive',
				'--volume', `${process.env.HOME}/.sentinelnode:/root/.sentinelnode`,
				'sentinel-dvpn-node', 'process', 'keys', 'list'
			];
			const s = spawn('docker',args,{shell:true,env:process.env,cwd:process.env.PWD});
			s.stdin.write(`${this.utils.escapeBashString(pw)}\n`);
			s.stdin.write(`${this.utils.escapeBashString(pw)}\n`);
			//const s = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD});
			//s.stdin.write('(echo derparoo;)');
			s.stdout.on('data',d=>{
				output += d.toString();
			})
			s.stderr.on('data',d=>{
			    console.log('stderr',d.toString());
			    reject({'error':d.toString()})
			})
			s.stdin.end();
			s.on('close',d=>{
			    const outputData = {};
			    output.split('\n').filter(d=>{
			    	return d.length > 0;
			    }).map(rec=>{
			    	let parts = rec.split(' ');/*.filter(p=>{
			    		return p.length > 0;
			    	});*/
			    	//allows for spaces at begin and end of name string...
			    	if(parts.length > 1){
			    		const name = parts.slice(0,-2).join(' '); 
			    		const addr = parts.slice(-2,-1)[0];

			    		outputData[name] = addr;
			    	}
			    })
			    resolve(outputData);
			});
		})
	}
	parseConfigFile(contents,filterValuesForUI){
		//filters for UI:
		const sectionsToHide = {
			handshake:true,
			keyring:false
		}
		const valsToHide = {
			//node:{
				interval_sessions:true,
				interval_status:true,
				provider:true,
				type:true,
				backend:true,
			//},
			//wireguard:{
				private_key:true,
				interface:true
			//}
		}
		//guts:
		let output = {};
		let lines = contents.split('\n');
		let sectionName;
		lines.filter(line=>{return line.length > 0}).map(line=>{
			if(line.trim().indexOf('[') == 0 && line.indexOf('=') == -1){
				//new section
				sectionName = line.replace(/\[/g,'').replace(/\]/g,'').trim();
				let canAdd = false;
				if(!filterValuesForUI){
					canAdd = true;
				}
				else{
					if(!sectionsToHide[sectionName]){
						canAdd = true;
					}
				}

				if(canAdd){
					output[sectionName] = {};
				}
				
			}
			else{
				//append to section
				if(filterValuesForUI && sectionsToHide[sectionName]){
					return;
				}
				const parts = line.split(' = ');
				if(parts.length > 1){
					let outSection;
					if(typeof sectionName == "undefined"){
						outSection = output
					}
					else{
						outSection = output[sectionName];
					}
					let type = parts[1].indexOf('"') >= 0 ? 'string' : 'number';
					type = (parts[1].indexOf('true') >= 0 || parts[1].indexOf('false') >= 0) && type == 'number' ? 'boolean' : type;
					let canFinish = false;
					if(!filterValuesForUI){
						canFinish = true;
					}
					else{
						if(!valsToHide[parts[0].trim()]){
							canFinish = true;
						}
					}
					if(canFinish){
						outSection[parts[0].trim()] = {
							leaf:true,
							type,
							value:parts[1].trim().replace(/"/g,'')
						}
					}
				}
			}
		});
		return output;
	}
	checkMachineStatus(){
		return new Promise((resolve,reject)=>{
			console.log('check machine status dvpn')
			this.getPorts().then(ports=>{
				console.log('node port',ports.node);
				const options = {
					host: 'localhost',
					port: ports.node,
					path: '/status',
					method:'GET',
					rejectUnauthorized: false,
					//requestCert: true,
					agent: false
				};
				
				
				let output = '';
				const request = http.request(options,response=>{
					//another chunk of data has been received, so append it to `str`
					
					response.on('data', (chunk) => {
						output += chunk;
					});

					//the whole response has been received, so we just print it out here
					response.on('end', () => {
						let json = [];
						try{
							json = JSON.parse(output);
						}
						catch(e){
							console.log('bad json response',output.toString());
						}

						resolve(true);

					});

					if(response.statusCode.toString() != '200'){
						//something went wrong
						reject(output);
					}
				});

				request.on('error', (err)=> {
				    reject(err)
				});
				request.end();
			}).catch(e=>{
				console.log('ports err',e);
				resolve(false);
			})
		})
	}
	autostartDVPN(socketIONamespace){
		const autostartFile = process.env.HOME+'/.HandyHost/sentinelData/autostart';
		const _this = this;
		
		if(fs.existsSync(autostartFile)){
			this.checkMachineStatus().then(running=>{
				console.log('is dvpn running ??',running);
				if(!running){
					if(typeof process.env.DVPNAUTO != "undefined"){
						getEncPayload(socketIONamespace);
					}
					else{
						//could be macos
						if(process.platform == 'darwin'){
							getMacPayload(socketIONamespace)
						}
						else{
							console.log('no dvpn autostart credentials found')
						}
					}
					
				}
				else{
					console.log('autostart: dvpn is already running')
				}
			}).catch(e=>{
				/*const params = JSON.parse(fs.readFileSync(autostartFile,'utf8'));
				this.launchDVPN(params.pw,socketIONamespace);*/
				if(typeof process.env.DVPNAUTO != "undefined"){
					const encFilePath = process.env.HOME+'/.HandyHost/keystore/'+process.env.DVPNAUTO;
					if(fs.existsSync(encFilePath)){
						this.utils.decrypt(encFilePath).then(pass=>{
							this.launchDVPN(pass,socketIONamespace);
						})
					}
					else{
						console.log('no encrypted credentials present')
					}
				}
				else{
					//could be macos
					if(process.platform == 'darwin'){
						getMacPayload(socketIONamespace)
					}
					else{
						console.log('no dvpn autostart credentials found')
					}
				}
			})
			
		}
		function getEncPayload(socketIO){
			const encFilePath = process.env.HOME+'/.HandyHost/keystore/'+process.env.DVPNAUTO;
			if(fs.existsSync(encFilePath)){
				_this.utils.decrypt(encFilePath).then(pass=>{
					_this.launchDVPN(pass,socketIO);
				})
			}
		}
		function getMacPayload(){
			getDarwinKeychainPW('HANDYHOST_DVPNAUTO').then(data=>{
				if(data.exists){
					_this.launchDVPN(data.value,socketIO);
				}
				else{
					console.log('no dvpn autostart credentials present on macos keychain')
				}
			})
		}
	}
	configureAutostart(params){
		const autostartFile = process.env.HOME+'/.HandyHost/sentinelData/autostart';
		
		if(params.autostart){
			if(process.platform == 'darwin'){
				this.utils.setDarwinKeychainPW(params.pw,'HANDYHOST_DVPNAUTO')
			}
			else{
				this.utils.encrypt(params.pw,true,'dvpn');
			}
			
			fs.writeFileSync(autostartFile,'true','utf8');
		}
		else{
			if(fs.existsSync(autostartFile)){
				fs.unlinkSync(autostartFile);
			}
		}
	}
	launchDVPN(pw,socketIONamespace){
		return new Promise((resolve,reject)=>{
			this.getPorts().then(ports=>{
				console.log('should start dvpn',ports)
				const tcp = ports.node;
				const udp = ports.wireguard;
				const args = [
					'run', 
					'--rm',
					'--interactive' ,
					'--volume', `${process.env.HOME}/.sentinelnode:/root/.sentinelnode` ,
					'--volume', '/lib/modules:/lib/modules' ,
					'--cap-drop=ALL' ,
					'--cap-add=NET_ADMIN' ,
					'--cap-add=NET_BIND_SERVICE' ,
					'--cap-add=NET_RAW' ,
					'--cap-add=SYS_MODULE' ,
					'--publish', `${tcp}:${tcp}/tcp` ,
					'--publish', `${udp}:${udp}/udp` ,
					'--sysctl', 'net.ipv4.ip_forward=1' ,
					'--sysctl', 'net.ipv6.conf.all.forwarding=1' ,
					'--sysctl', 'net.ipv6.conf.all.disable_ipv6=0' ,
					'--sysctl', 'net.ipv6.conf.default.forwarding=1' ,
					'sentinel-dvpn-node', 'process', 'start'
				];
				let output = '';
				let lineCount = 0;
				let hasFailed = false;
				let hasReturned = false;
				
				const s = spawn('docker',args,{shell:true,env:process.env,cwd:process.env.PWD,detached:true});
				s.stdin.write(`${this.utils.escapeBashString(pw)}\n`);
				s.stdout.on('data',d=>{
					socketIONamespace.to('dvpn').emit('logs',d.toString());
					output += d.toString();
					lineCount++;
					if(lineCount >= 100){
						//truncate
						output = output.split('\n').slice(-20).join('\n');
					}
					fs.writeFileSync(`${process.env.HOME}/.HandyHost/sentinelData/hostLogs`,output,'utf8')
				});
				s.stderr.on('data',d=>{
					//hasFailed = true;
					output += d.toString();
					
				    //console.log('stderr',d.toString());
				    lineCount++;
					if(lineCount >= 100){
						//truncate
						output = output.split('\n').slice(-20).join('\n');
					}
					fs.writeFileSync(`${process.env.HOME}/.HandyHost/sentinelData/hostLogs`,output,'utf8')
				    socketIONamespace.to('dvpn').emit('logs',d.toString());
				    //reject({'error':d.toString()})
				});
				s.stdin.end();
				s.on('close',d=>{
					hasFailed = true;
					//console.log('closed',output);
					socketIONamespace.to('dvpn').emit('logs',"\nDVPN NODE STOPPED\n");
				    socketIONamespace.to('dvpn').emit('status','disconnected');
				    if(!hasReturned){
				    	resolve({closed:output});
					}
				})
				setTimeout(()=>{
					//will pipe output to socket.io before this may fire
					if(!hasFailed){
						hasReturned = true;
						socketIONamespace.to('dvpn').emit('launched');
						resolve({status:'launched'});
					}
				},1000)
				
			})
			
		});
	}
	stopDVPN(){
		//stop the dvpn docker container
		return new Promise((resolve,reject)=>{
			const s = spawn('bash',['./dvpnAPI/stopdvpn.sh'],{shell:true,env:process.env,cwd:process.env.PWD});
			s.stderr.on('data',d=>{
				console.log('error stopping container',d.toString())
			})
			s.on('close',()=>{
				resolve();
			})
		})
		
	}
}