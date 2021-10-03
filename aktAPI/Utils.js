import {spawn} from 'child_process';
import fs from 'fs';
import {CommonUtils} from '../CommonUtils.js';
export class AKTUtils{
	constructor(configFilePath,k8sUtils,walletUtils){
		this.commonUtils = new CommonUtils();
		this.configFilePath = configFilePath;
		this.providerYAMLPath = process.env.HOME+'/.HandyHost/aktData/provider.yaml';
		this.k8sUtils = k8sUtils;
		this.walletUtils = walletUtils
	}
	getHosts(existingConfigData){
		//get hosts on my local network
		if(typeof this.macLookup == "undefined"){
			this.macLookup = this.loadMacLookupCSV();
		}
		return new Promise((resolve,reject)=>{
			let getIPCommand;
			let getIPOpts;
			let ipCommand;
			let ipRangeOut;
			
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
				ipRangeOut = d.toString('utf8').trim();
			});
			ipCommand.on('close',()=>{
				if(process.platform == 'linux'){
					ipRangeOut = ipRangeOut.split(' ')[0];
				}
				ipRangeOut = ipRangeOut.split('.').slice(0,-1).join('.')
				ipRangeOut += '.0/24';
				console.log('nmap ip range ',ipRangeOut);
				const nmap = spawn('nmap',['-sP',ipRangeOut])
				nmap.on('close',()=>{
					//nmap refreshes the network for arp, sheesh...
					//and first arp will often fill the reouter tables so do another
					const arp0 = spawn('arp',['-a']);
					arp0.on('close',()=>{
						const arp = spawn('arp',['-a']);
						let output = '';
						arp.stdout.on('data',d=>{
							output += d.toString();
						})
						arp.stderr.on('data',d=>{
							reject(d.toString());
						})
						arp.on('close',()=>{
							this.processArp(output,existingConfigData).then(data=>{
								resolve(data);
							}).catch(err=>{
								reject(err);
							})
						})
					})
					
				})
			})
			
			

			
		})
	}
	processArp(data,existingConfigData){
		let machines = [];
		let discoveredMachines = {};
		return new Promise((resolve,reject)=>{
			const lines = data.split('\n');
			//console.log('lines',lines);
			let didConfiguredMachineChange = false;
			lines.map(line=>{
				let cells = line.split(' ');
				cells = cells.filter(c=>{return c.length > 0;});
				let machine = {};
				let isConfiguredNode = false;//do i exist in the config already..
				
				cells.map((cell,i)=>{
					let prop;
					switch(i){
						case 0:
							//hostname
							prop = 'hostname';
							machine.hostname = cell;
						break;
						case 1:
							//ip
							prop = 'ip';
							cell = cell.replace('(','').replace(')','');

						break;
						case 3:
							//mac
							if(cell.indexOf('incomplete') == -1){
								prop = 'mac';
								cell = cell.split(':').map(c=>{
									if(c.length == 1){
										return '0'+c;
									}
									return c;
								}).join(':')
								discoveredMachines[cell] = true;
								//macOS drops leadng 0's from parts of the mac addr in arp i guess?????
								
								machine['manufacturer'] = this.getMfg(cell);
								if(typeof existingConfigData.nodes != "undefined"){
									const node = existingConfigData.nodes.find(node=>{
										return node.mac == cell;
									})
									if(typeof node != "undefined"){
										//uhoh we have 2 entries!?! 
										//likely we updated the ip address
										isConfiguredNode = true;
										didConfiguredMachineChange = true;
									}
									/*if(typeof node != "undefined"){
										Object.keys(node).map(key=>{
											machine[key] = node[key];
										})
									}*/
								}
							}
							
						break;
						/*case 4:
							//adapter
							prop = 'adapter';
						break;
						case 6:
							//scope
							prop = 'scope';
						break;
						case 7:
							//net
							prop = 'net';
						break;*/
					}
					if(typeof prop != "undefined"){
						machine[prop] = cell;
					}
					
				})
				if(isConfiguredNode){
					//we saw a duplicate node. 
					//update the existing config
					existingConfigData.nodes.map(existingNode=>{
						if(existingNode['mac'] == machine['mac']){
							//same.
							Object.keys(machine).map(key=>{
								existingNode[key] = machine[key];
							});
							machines.push(existingNode);
						}

					});
				}
				else{
					if(Object.keys(machine).length > 0 && typeof machine.mac != "undefined"){
						machines.push(machine);
					}
				}
				
				
			});
			if(typeof existingConfigData.nodes != "undefined"){
				existingConfigData.nodes.map(node=>{
					if(typeof discoveredMachines[node.mac] == "undefined"){
						machines.push(node);
						discoveredMachines[node.mac] = true;
					}
				})
			}
			
			this.getHostnames(machines).then(output=>{
				if(didConfiguredMachineChange){
					//save config after we update machine names
					const byMac = {};
					machines.map(machine=>{
						byMac[machine.mac] = machine.hostname;
					});
					existingConfigData.nodes.map(node=>{
						if(typeof byMac[node.mac] != "undefined"){
							node.hostname = byMac[node.mac];
						}
						if(typeof existingConfigData.preConfiguredNVMe != "undefined"){
							if(typeof existingConfigData.preConfiguredNVMe[node.hostname.split('.')[0]] != "undefined"){
								node.sshConfigured = true;
								node.user = 'ansible';
							}
						}
					})
					this.saveClusterConfig(existingConfigData,this.configFilePath);
				}
				
				if(typeof existingConfigData.preConfiguredNVMe != "undefined"){
					//check if this is a preconfigured node so we can mark that we already did ssh access
					output.map(node=>{
						if(typeof existingConfigData.preConfiguredNVMe[node.hostname.split('.')[0]] != "undefined"){
							node.sshConfigured = true;
							node.user = 'ansible';
						}
					})
					
				}
				let preconfiguredMonikers = {};
				const preconfiguredMonikersPath = process.env.HOME+'/.HandyHost/aktData/preconfiguredMonikers.json';
				if(fs.existsSync(preconfiguredMonikersPath)){
					preconfiguredMonikers = JSON.parse(fs.readFileSync(preconfiguredMonikersPath,'utf8'));
				}
				if(Object.keys(preconfiguredMonikers).length > 0){
					output.map(node=>{
						if(preconfiguredMonikers[node.hostname.split('.')[0]]){
							node.sshConfigured = true;
							node.user = 'ansible';
						}
					})
				}
					
				
				resolve(output);
				
			}).catch(error=>{
				console.log('error with host lookup',error);
				resolve(machines);
			})
			//resolve(machines);
		});
		
	}
	getHostnames(machines){
		return new Promise((resolve,reject)=>{
			//avahi-resolve-address
			if(process.platform != 'darwin'){
				let machineCount = machines.length;
				let finished = 0;
				machines.map(machine=>{
					const ip = machine.ip;
					const s = spawn('avahi-resolve-address',[ip]);
					let out = '';
					s.stdout.on('data',(d)=>{
						out += d.toString();
					})
					s.stderr.on('data',(d)=>{
						console.log('avahi resolve address err',d.toString())
					})
					s.on('close',()=>{
						let cells = out.split('\t').filter(cell=>{
							return cell.length > 0;
						});
						if(cells.length > 1){
							machine.hostname = cells[1].replace('\n','').trim();
						}
							
						finished++;
						if(finished == machineCount){
							resolve(machines);
						}
					})
				})
			}
			else{
				//no avahi utils on mac, nor is arp (or anything) consistent at getting hostnames
				//in this case we will use the pre-registered nodes to show any hostnames
				//laod this.configFilePath
				let config = {};
				if(fs.existsSync(this.configFilePath)){
					config = JSON.parse(fs.readFileSync(this.configFilePath,'utf8'));
				}
				let indexedByIP = {};
				if(typeof config.preConfiguredNVMe != "undefined"){
					Object.keys(config.preConfiguredNVMe).map(machineName=>{
						const ip = config.preConfiguredNVMe[machineName].ip;
						const localAddress = config.preConfiguredNVMe[machineName].reservedNetworkHost;
						const hostname = machineName;
						indexedByIP[ip] = {
							ip,
							localAddress,
							hostname
						};
					});
					
				}
				if(typeof config.nodes != "undefined"){
					config.nodes.map(node=>{
						if(node.hostname != '?'){
							indexedByIP[node.ip] = {
								ip:node.ip,
								localAddress:node.hostname,
								hostname:node.hostname
							}
						}
					})
				}
				machines.map(machine=>{
					const ip = machine.ip;
					let name = '?';
					if(typeof indexedByIP[ip] != "undefined"){
						machine.hostname = indexedByIP[ip].localAddress;
					}
				})
				resolve(machines);
			}
		})
	}
	getMfg(macAddress){

		let macSplit = macAddress.split(':')
		let first3 = macSplit.slice(0,3).join(':').toUpperCase();
		let first4 = macSplit.slice(0,4).join(':').toUpperCase();
		let first5 = macSplit.slice(0,5).join(':').toUpperCase();
		if(typeof this.macLookup[first3] != "undefined"){
			return this.macLookup[first3];
		}
		else if(typeof this.macLookup[first4] != "undefined"){
			return this.macLookup[first4];
		}
		else if(typeof this.macLookup[first5] != "undefined"){
			return this.macLookup[first5];
		}
		else return 'unknown';
	}
	loadMacLookupCSV(){
		const tsv = fs.readFileSync('./aktAPI/macLookup.tsv','utf8');
		const lookup = {};
		tsv.split('\n').map(line=>{
			let cells = line.split('\t');
			lookup[cells[0]] = cells.slice(1).join('\t').trim();
		})
		return lookup;
	}
	getConfigs(filterConfig){
		
		return new Promise((resolve,reject)=>{
			const nodeConfig = fs.readFileSync(`${process.env.HOME}/.akash/config/config.toml`,'utf8');
			//const appConfig = fs.readFileSync(`${process.env.HOME}/.akash/config/app.toml`,'utf8');
			
			const nodeParsed = this.parseConfigFile(nodeConfig,filterConfig);
			//const appParsed = this.parseConfigFile(appConfig,filterConfig);
			resolve({
				//app:appParsed,
				node:nodeParsed
			})
		}).catch(e=>{
			console.log('error',e);
		})
	}
	updateConfigs(newConfigData){
		return new Promise((resolve,reject)=>{
			this.getConfigs().then(configJSON=>{
				let updatedConfig = configJSON;
				Object.keys(newConfigData).map(tlKey=>{
					let ogItem = updatedConfig[tlKey];
					console.log('ogItem',tlKey,ogItem,newConfigData[tlKey]);
					if(ogItem.leaf){
						//update the value then
						updatedConfig[tlKey].value = newConfigData[tlKey];
					}
					else{
						Object.keys(newConfigData[tlKey]).map(secondLevelKey=>{
							console.log("L2 KEY",secondLevelKey);
							if(typeof updatedConfig[tlKey][secondLevelKey] != "undefined"){
								if(updatedConfig[tlKey][secondLevelKey].leaf){
									//is leaf
									updatedConfig[tlKey][secondLevelKey].value = newConfigData[tlKey][secondLevelKey];
								}
								else{
									Object.keys(newConfigData[tlKey][secondLevelKey]).map(key=>{
										console.log('L3 KEY',key);
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
					//app:'',
					node:''
				}
				console.log('did update?',JSON.stringify(updatedConfig,null,2));
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
				fs.writeFileSync(`${process.env.HOME}/.akash/config/config.toml`,tomls.node,'utf8');
				//fs.writeFileSync(`${process.env.HOME}/.akash/config/app.toml`,tomls.app,'utf8');
				
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
	
	parseConfigFile(contents,filterValuesForUI){
		//filters for UI:
		const sectionsToHide = {
			handshake:true,
			keyring:true
		}
		const valsToHide = {
			//node:{
				interval_sessions:true,
				interval_status:true,
				provider:true,
				type:true,
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
			if(line.trim().indexOf('#') == 0){
				//is comment
				return;
			}
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
	enableSSHForNode(node,nodeUser,nodePW,configPath){
		const clusterConfigJSON = JSON.parse(fs.readFileSync(configPath));
		return new Promise((resolve,reject)=>{
			
			console.log('needs ssh configured ?',node)
			new Promise((res,rej)=>{
				if(!fs.existsSync(process.env.HOME+'/.ssh/handyhost')){
					//create a new ssh key
					const p = spawn('ssh-keygen',['-t','rsa','-q','-N','','-f',process.env.HOME+'/.ssh/handyhost'])
					p.on('close',()=>{
						console.log('created new ssh key')
						res();
					})
				}
				else{
					res();
				}
			}).then(()=>{
				//TODO: ./sshCopyIDAutomated user host pw keylocation
				let cpid;
				let command;
				let args;
				const cleanup = spawn('bash',['./aktAPI/cleanupKnownHosts.sh',node.ip],{shell:true,env:process.env,cwd:process.env.PWD});
				//cleanup ssh keys in case we talked with this IP before..
				cleanup.on('close',()=>{
					console.log('cleanup known hosts done')
					if(process.platform == 'darwin'){
						this.commonUtils.encrypt(nodePW).then(encPath=>{
							//cpid = spawn('./sshCopyIdAutomated.sh',[nodeUser,node.ip,nodePW,process.env.HOME+'/.ssh/handyhost'],{env:process.env,cwd:process.env.PWD+'/aktAPI'})
							const homebrewPrefixMAC = process.arch == 'arm64' ? '/opt/homebrew' : '/usr/local';
							command = './sshCopyIdAutomated.sh';
							args = [nodeUser,node.ip,encPath,process.env.HOME+'/.ssh/handyhost',homebrewPrefixMAC+'/opt/openssl@1.1/bin/openssl'];
							finish();
						})
						
					}
					else{
						//cpid = spawn('sshpass',['-p',nodePW,'ssh-copy-id','-i',process.env.HOME+'/.ssh/handyhost',nodeUser+'@'+node.ip,'-o','StrictHostKeyChecking=no'])
						command = 'sshpass';
						args = ['-p',nodePW,'ssh-copy-id','-i',process.env.HOME+'/.ssh/handyhost',nodeUser+'@'+node.ip];
						finish();
					}
				})
				
				function finish(){
					console.log('command',command)
					cpid = spawn(command,args,{env:process.env,cwd:process.env.PWD+'/aktAPI'})
					let hasError = false;
					let errOut = '';
					cpid.stdout.on('data',(d)=>{
						errOut += d.toString();
						console.log('set ssh key?',d.toString())
					})
					cpid.stderr.on('data',(d)=>{
						errOut += d.toString();
						console.log('set ssh key error?',d.toString())
						hasError = true;
					})
					cpid.on('close',()=>{
						//TODO: Verify ssh access
						if(errOut.indexOf('invalid password') >= 0){
							console.log('rejecting');
							reject({error:'Invalid Password for '+nodeUser+'@'+node.ip});
							return;
						}
						const hostname = spawn('ssh',['-i',process.env.HOME+'/.ssh/handyhost',nodeUser+'@'+node.ip,'hostname'])
						let out = '';
						let hostnameErr = '';
						hostname.stdout.on('data',(d)=>{
							out += d.toString();
						})
						hostname.stderr.on('data',(d)=>{
							hostnameErr += d.toString()
						})
						hostname.on('close',()=>{
							console.log('output',out);
							
							if(out.trim() != ''){
								clusterConfigJSON.nodes.map(configNode=>{
									if(configNode.mac == node.mac){
										configNode.sshConfigured = true;
										configNode.user = nodeUser;
										configNode.hostname = out.trim()+'.local';
										if(typeof configNode.kubernetes != "undefined"){
											configNode.kubernetes.name = out.trim();
										}
									}
								})
								fs.writeFileSync(configPath,JSON.stringify(clusterConfigJSON,null,2),'utf8');
								resolve({saved:true,config:clusterConfigJSON});
							}
							else{
								reject({error:'Error connecting to host: '+hostnameErr});
							}
						
						})
						
					})
				}
				
			})
			
		
			
		})
	}
	saveClusterConfig(configJSON,configPath,socketIONamespaces){
		return new Promise((resolve,reject)=>{
			if(typeof configJSON.provider != "undefined"){
				if(Object.keys(configJSON.provider).length > 0){
					const tab = '  ';
					let yaml = ``;
					yaml += `host: https://${configJSON.provider.providerIP}:8443\n`
					yaml += `attributes:\n`;
					yaml += `${tab}- key: region\n`;
					yaml += `${tab}  value: ${configJSON.provider.regionName}\n`;
					yaml += `${tab}- key: host\n`;
					yaml += `${tab}  value: ${configJSON.provider.clusterName}\n`;
					fs.writeFileSync(this.providerYAMLPath,yaml,'utf8');
					//we need to verify that the registration needs or does not need to be updated
					if(typeof socketIONamespaces != "undefined"){
						//this is the save event that needs to ping the client if they need to update..
						const args = ['query', 'provider', 'get', configJSON.provider.providerWalletAddress, '--output', 'json'];
						let regOut = '';
						let regErr = '';
						const getRegs = spawn('./bin/akash',args,{shell:true,env:process.env,cwd:process.env.HOME+'/.HandyHost/aktData'})
						getRegs.stdout.on('data',d=>{
							regOut += d.toString();
						})
						getRegs.stderr.on('data',d=>{
							regErr += d.toString();
							console.log('get registration stderr',d.toString());
						})
						getRegs.on('close',()=>{
							console.log('regout',regOut);
							console.log('regerr',regErr);
							const providerHasGeneratedCert = fs.existsSync(process.env.HOME+'/.akash/'+configJSON.provider.providerWalletAddress+'.pem');
				
							if(regErr.indexOf('invalid provider') >= 0){
								Object.keys(socketIONamespaces).map(serverName=>{
									socketIONamespaces[serverName].namespace.to('akt').emit('providerRegistrationEvent',{dasValidRegistration:false, exists:false, hasValidCertificate: providerHasGeneratedCert,wallet:configJSON.provider.providerWalletAddress});
								})
								//socketIONamespace.to('akt').emit('providerRegistrationEvent',{dasValidRegistration:false, exists:false, hasValidCertificate: providerHasGeneratedCert,wallet:configJSON.provider.providerWalletAddress});
							}
							else{
								let json = {};
								try{
									json = JSON.parse(regOut);
								}
								catch(e){
									console.log('couldnt parse stdout',regOut);
								}
								if(Object.keys(json).length > 0){
									//ok compare and notify if needed
									const config = json;
									
									let shouldNotify = false;
									if(config.host_uri != `https://${configJSON.provider.providerIP}:8443`){
										shouldNotify = true;
									}
									const region = config.attributes.find(d=>{return d.key == 'region';})
									const host = config.attributes.find(d=>{return d.key == 'host';});
									if(typeof region == "undefined"){
										shouldNotify = true;
									}
									else{
										if(region.value != configJSON.provider.regionName){
											shouldNotify = true;
										}
									}
									if(typeof host == "undefined"){
										shouldNotify = true;
									}else{
										if(host.value != configJSON.provider.clusterName){
											shouldNotify = true;
										}
									}
									console.log('should we notify of a registration change?',shouldNotify);
									if(!shouldNotify){
										//check if config file exists for UI checkboxes..
										
										if(!fs.existsSync(process.env.HOME+'/.HandyHost/aktData/providerReceipt.'+configJSON.provider.providerWalletAddress+'.json')){
											fs.writeFileSync(process.env.HOME+'/.HandyHost/aktData/providerReceipt.'+configJSON.provider.providerWalletAddress+'.json',JSON.stringify(config),'utf8');
										}
										Object.keys(socketIONamespaces).map(serverName=>{
											socketIONamespaces[serverName].namespace.to('akt').emit('providerRegistrationEvent',{hasValidRegistration:true, exists:true, hasValidCertificate: providerHasGeneratedCert,wallet:configJSON.provider.providerWalletAddress});
										})
										//socketIONamespace.to('akt').emit('providerRegistrationEvent',{hasValidRegistration:true, exists:true, hasValidCertificate: providerHasGeneratedCert,wallet:configJSON.provider.providerWalletAddress});
									}
									else{
										if(fs.existsSync(process.env.HOME+'/.HandyHost/aktData/providerReceipt.'+configJSON.provider.providerWalletAddress+'.json')){
											fs.unlinkSync(process.env.HOME+'/.HandyHost/aktData/providerReceipt.'+configJSON.provider.providerWalletAddress+'.json');
										}
										Object.keys(socketIONamespaces).map(serverName=>{
											socketIONamespaces[serverName].namespace.to('akt').emit('providerRegistrationEvent',{hasValidRegistration:false, exists:true, hasValidCertificate: providerHasGeneratedCert,wallet:configJSON.provider.providerWalletAddress});
										})
										//socketIONamespace.to('akt').emit('providerRegistrationEvent',{hasValidRegistration:false, exists:true, hasValidCertificate: providerHasGeneratedCert,wallet:configJSON.provider.providerWalletAddress});
									}
								}
							}
						})
					}
				}
			}
			fs.writeFileSync(configPath,JSON.stringify(configJSON,null,2),'utf8');
			resolve({saved:true});
		})
	}
	getCurrentAkashVersion(){
		return new Promise((resolve,reject)=>{
			const args = ['version'];
			const getVersion = spawn('./bin/akash',args,{shell:true,env:process.env,cwd:process.env.HOME+'/.HandyHost/aktData'});
			let output = '';
			getVersion.stdout.on('data',d=>{
				output += d.toString();
			})
			getVersion.stderr.on('data',d=>{
				output += d.toString();
			})
			getVersion.on('close',()=>{
				const latest = spawn('./getAkashLatestVersion.sh',[],{env:process.env,cwd:process.env.PWD+'/aktAPI'});
				let latestOut = '';
				latest.stdout.on('data',d=>{
					latestOut += d.toString();
				});
				latest.on('close',()=>{
					if(latestOut == ''){
						//must have been an error, just return installed as to not cause false alarms
						latestOut = output.trim();
					}
					resolve({
						installed:output.trim(),
						latest:latestOut.trim()
					});
				})
				
			})
		});
	}
	updateAkashToLatest(socketIONamespaces){
		return new Promise((resolve,reject)=>{
			this.walletUtils.pauseProvider().then(()=>{
				const args = ['./install.sh'];
				const updater = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
				updater.stdout.on('data',d=>{
					Object.keys(socketIONamespaces).map(serverName=>{
						socketIONamespaces[serverName].namespace.to('akt').emit('akashInstallLogs',d.toString());
					})
					//socketIONamespace.to('akt').emit('akashInstallLogs',d.toString());
				})
				updater.stderr.on('data',d=>{
					Object.keys(socketIONamespaces).map(serverName=>{
						socketIONamespaces[serverName].namespace.to('akt').emit('akashInstallLogs',d.toString());
					})
					//socketIONamespace.to('akt').emit('akashInstallLogs',d.toString());
				})
				updater.on('close',()=>{
					
					resolve({updated:true});
					this.k8sUtils.updateKubespray(socketIONamespaces).then((status)=>{
						//provider is unpaused in updateKubespray
						console.log('done updating kubespray/cluster',status);
					})
				})
			});
		})
	}


}