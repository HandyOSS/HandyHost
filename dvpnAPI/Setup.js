import fs from 'fs';
import {spawn} from 'child_process';
import https from 'https';
import generator from 'project-name-generator';

export class DVPNSetup{
	constructor(){
		this.redlistPortsPath = process.env.HOME+'/.HandyHost/ports.json';
		
	}
	
	initWallet(pw,walletName){
		return new Promise((resolve,reject)=>{
			const args = ['./dvpnAPI/addNewKey.sh',pw,walletName];
			let output = '';
			let stderrOutput = '';
			const s = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD});
			//s.stdin.write('(echo derparoo;)');
			s.stdout.on('data',d=>{
				output += d.toString();
			})
			s.stderr.on('data',d=>{
			    //console.log('stderr',d.toString());
			    //reject({'error':d.toString()})
			    stderrOutput += d.toString();
			})
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
			const args = ['./dvpnAPI/recoverKey.sh',pw,`"${seed}"`,walletName];
			let output = '';
			let stderrOutput = '';
			const s = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD});
			//s.stdin.write('(echo derparoo;)');
			s.stdout.on('data',d=>{
				output += d.toString();
			    console.log('stdout',d.toString());
			})
			s.stderr.on('data',d=>{
			    console.log('stderr',d.toString());
			    stderrOutput += d.toString();
			    //reject({'error':d.toString()})
			})
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

			const args = ['./dvpnAPI/initConfigs.sh'];
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
			    console.log('spawn closed',d);
			    //1.1.0rc0 dvpn-node requires from and price to be set in order to init wallets now.
			    const newConfigParam = {
			    	node:{
			    		chain:{
			    			id:'sentinelhub-2'
			    		},
			    		keyring:{
			    			from:`"__default__"`
			    		},
			    		node:{
			    			price:'10dvpn',
			    			remote_url:'https://0.0.0.0:8585',
			    			listen_on:'0.0.0.0:8585',
			    			moniker: generator({words: 3}).dashed
			    		}
			    	}
			    };
			    this.updateConfigs(newConfigParam);
			    resolve({exists:true});
			})
		});
	}
	getConfigs(filterConfig){
		
		return new Promise((resolve,reject)=>{
			const nodeConfig = fs.readFileSync(`${process.env.HOME}/.sentinelnode/config.toml`,'utf8');
			const wgConfig = fs.readFileSync(`${process.env.HOME}/.sentinelnode/wireguard.toml`,'utf8');
			console.log('config',wgConfig);
			const nodeParsed = this.parseConfigFile(nodeConfig,filterConfig);
			const wgParsed = this.parseConfigFile(wgConfig,filterConfig);
			console.log('parsed',wgParsed);
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
			const args = ['./dvpnAPI/listKeys.sh',pw];
			let output = '';
			const s = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD});
			//s.stdin.write('(echo derparoo;)');
			s.stdout.on('data',d=>{
				output += d.toString();
			})
			s.stderr.on('data',d=>{
			    console.log('stderr',d.toString());
			    reject({'error':d.toString()})
			})
			s.on('close',d=>{
			    const outputData = {};
			    output.split('\n').filter(d=>{
			    	return d.length > 0;
			    }).map(rec=>{
			    	let parts = rec.split(' ').filter(p=>{
			    		return p.length > 0;
			    	});
			    	if(parts.length > 1){
			    		outputData[parts[0].trim().toLowerCase()] = parts[1].trim();
			    	}
			    })
			    resolve(outputData);
			})
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
	autostartDVPN(socketIONamespace){
		const autostartFile = process.env.HOME+'/.HandyHost/sentinelData/autostart.json';
		if(fs.existsSync(autostartFile)){
			const params = JSON.parse(fs.readFileSync(autostartFile,'utf8'));
			this.launchDVPN(params.pw,socketIONamespace);
		}
	}
	configureAutostart(params){
		const autostartFile = process.env.HOME+'/.HandyHost/sentinelData/autostart.json';
		if(params.autostart){
			fs.writeFileSync(autostartFile,JSON.stringify(params),'utf8');
		}
		else{
			fs.unlinkSync(autostartFile);
		}
	}
	launchDVPN(pw,socketIONamespace){
		return new Promise((resolve,reject)=>{
			this.getPorts().then(ports=>{
				console.log('should start dvpn',ports)
				const args = ['./dvpnAPI/launchdvpn.sh',pw,ports.node,ports.wireguard];
				let output = '';
				let lineCount = 0;
				let hasFailed = false;
				let hasReturned = false;
				const s = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD,detached:true});
				//s.stdin.write('(echo derparoo;)');
				fs.writeFileSync(`${process.env.HOME}/.HandyHost/sentinelData/hostLogs`,output,'utf8')
				s.stdout.on('data',d=>{
					//console.log('stdout',d.toString());
					socketIONamespace.to('dvpn').emit('logs',d.toString());
					output += d.toString();
					lineCount++;
					if(lineCount >= 100){
						//truncate
						output = output.split('\n').slice(-20).join('\n');
					}
					fs.writeFileSync(`${process.env.HOME}/.HandyHost/sentinelData/hostLogs`,output,'utf8')
				})
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
				})
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