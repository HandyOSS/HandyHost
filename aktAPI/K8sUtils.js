import fs from 'fs';
import {spawn} from 'child_process';
import https from 'https';
import {DiskUtils} from './DiskUtils.js';
import yaml from 'js-yaml';
import {CommonUtils} from '../CommonUtils.js';

export class K8sUtils{
	constructor(configPath){
		this.configJSONPath = configPath; //the json for handyhost app about the cluster inventory
		this.diskUtils = new DiskUtils();
		this.commonUtils = new CommonUtils();
	}
	generateUbuntuCloudInit(params,hosts){
		return new Promise((resolve,reject)=>{
			let hostname = params.hostname;
			let path = params.path;
			//1. check hostname doesnt exist already
			let names = hosts.map(h=>{
				return h.hostname;
			})
			//console.log('existing hostnames',names)
			if(names.indexOf(hostname+'.local') >= 0){
				resolve({error:'Hostname already exists. Choose another hostname.'})
				return;
			}
			const clusterConfig = JSON.parse(fs.readFileSync(this.configJSONPath,'utf8'));
			
			if(typeof clusterConfig.preConfiguredNVMe == "undefined"){
				clusterConfig.preConfiguredNVMe = {};
			}
			if(typeof clusterConfig.preConfiguredNVMe[hostname] != "undefined"){
				//uhoh we already created this hostname but havent seen the node yet
				resolve({error:'Hostname already reserved for another configured NVMe. Choose another hostname.'})
				return;
			}

			//2. check if ssh key exists
			this.generateSSHKey().then(()=>{
				//done
				const ssh_pub_key = fs.readFileSync(process.env.HOME+'/.ssh/handyhost.pub','utf8');
				const cloudInitTemplate = fs.readFileSync('./aktAPI/ubuntu-cloud-init-template','utf8');
				
				let cloudInitOutput = cloudInitTemplate.replace(/__HOSTNAME__/g,hostname);
				cloudInitOutput = cloudInitOutput.replace(/__SSH_PUB_KEY__/g,ssh_pub_key);
				//3. write the config
				fs.writeFileSync(path+'/user-data',cloudInitOutput,'utf8');

				clusterConfig.preConfiguredNVMe[hostname] = {
					hostname,
					path,
					reservedNetworkHost:hostname+'.local',
					isDiskConfigured:true
				}
				fs.writeFileSync(this.configJSONPath,JSON.stringify(clusterConfig),'utf8');
				resolve({success:true});
			})


		});
	}
	generateSSHKey(){
		return new Promise((resolve,reject)=>{
			if(!fs.existsSync(process.env.HOME+'/.ssh/handyhost')){
				//create a new ssh key
				const p = spawn('ssh-keygen',['-t','rsa','-q','-N','','-f',process.env.HOME+'/.ssh/handyhost'])
				p.on('close',()=>{
					console.log('created new ssh key')
					resolve();
				})
			}
			else{
				resolve();
			}
		})
		
	}
	createKubernetesInventory(configPath,socketIONamespace){
		return new Promise((resolve,reject)=>{

			const configJSON = JSON.parse(fs.readFileSync(configPath,'utf8'));
			//take configJSON and make k8s inventory
			let tab = '  ';
			let config = 'all:\n';
			config += `${tab}vars:\n`;
			config += `${tab}${tab}cluster_id: "1.0.0.1"\n`;
			//config += `${tab}${tab}ansible_user:ubuntu\n`;
			config += `${tab}hosts:\n`;
			let nodeNames = [];
			let masterNodeName = '';
			let masterUser = '';
			let masterIP = ''
			let masterMDNS = '';
			let etcdNodeName = '';
			let ingressNode = '';
			let noneNode = ''; //in case we didnt add ingress...
			let allIPs = [];
			configJSON.nodes.filter(node=>{
				return node.kubernetes.ingress;
			}).map(node=>{
				ingressNode = node.kubernetes.name;
			})
			configJSON.nodes.map((node,i)=>{
			    //let name = node.hostname == '?' : 'akashnode'+i : node.hostname.split('.local')[0];
				let name = node.kubernetes.name;
				if(node.kubernetes.role == 'master'){
					masterNodeName = name;
					masterUser = node.user;
					masterIP = node.ip;
					allIPs.push(node.ip);
					masterMDNS = node.hostname;
					//ingressNode = name;
				}
				if(node.kubernetes.role == 'etcd'){
					etcdNodeName = name;
				}
				/*if(node.kubernetes.role == 'ingress'){
					ingressNode = name;
				}*/
				if(node.kubernetes.role == 'none'){
					noneNode = name;
				}
				if(node.kubernetes.isCompute){
					nodeNames.push(name);
				}
				if(configJSON.nodes.length == 1){
					etcdNodeName = name;
					ingressNode = name;
				}
				if(i == configJSON.nodes.length-1){
					//its the last node, check if we set etcd and ingress
					if(ingressNode == ''){
						ingressNode = name;
					}
					if(etcdNodeName == ''){
						etcdNodeName = name;
					}
				}

				let entry = `${tab}${tab}${name}:\n`;
				   entry += `${tab}${tab}${tab}ansible_host: ${node.hostname}\n`;
 				   entry += `${tab}${tab}${tab}ansible_user: ${node.user}\n`;
				config += entry;
			})

			config += `${tab}children:\n`;
			config += `${tab}${tab}kube-master:\n`
			config += `${tab}${tab}${tab}hosts:\n`;
			config += `${tab}${tab}${tab}${tab}${masterNodeName}:\n`;
			config += `${tab}${tab}etcd:\n`;
			config += `${tab}${tab}${tab}hosts:\n`;
			config += `${tab}${tab}${tab}${tab}${etcdNodeName}:\n`
			config += `${tab}${tab}kube-node:\n`;
			config += `${tab}${tab}${tab}hosts:\n`;
			nodeNames.map(name=>{
				config += `${tab}${tab}${tab}${tab}${name}:\n`;
			});
			config += `${tab}${tab}calico-rr:\n`;
			config += `${tab}${tab}${tab}hosts:\n`;
			nodeNames.map(name=>{
				config += `${tab}${tab}${tab}${tab}${name}:\n`;
			});
			
			config += `${tab}${tab}k8s-cluster:\n`;
			config += `${tab}${tab}${tab}children:\n`;
			config += `${tab}${tab}${tab}${tab}kube-master:\n`;
			config += `${tab}${tab}${tab}${tab}kube-node:\n`;
			config += `${tab}${tab}${tab}${tab}calico-rr:\n`;

			console.log('built config',config);
			fs.writeFileSync(process.env.HOME+'/.HandyHost/aktData/inventory.yaml',config,'utf8');
			//TODO write to file, build & launch k8s
			this.teardownOldCluster(socketIONamespace).then(()=>{
				socketIONamespace.to('akt').emit('k8sBuildLogStatus',{part:'teardown',status:'finished'})
				this.initNewCluster(socketIONamespace).then(()=>{
					this.cleanupKnownHosts(allIPs).then(()=>{
						this.postInitNewCluster(socketIONamespace,masterNodeName,masterUser,masterIP,masterMDNS,ingressNode).then(()=>{
							socketIONamespace.to('akt').emit('k8sBuildLogStatus',{part:'init',status:'finished'})
							resolve({success:true})
						});
					});
					
					
				})
			})
			resolve({config});
		}).catch(error=>{
			reject(error);
		});
	}
	cleanupKnownHosts(allIPs){
		return new Promise((resolve,reject)=>{
			// ssh-keygen -f "/home/earthlab/.ssh/known_hosts" -R "192.168.0.218"
			let finished = 0;
			const finCount = allIPs.length;
			allIPs.map(ip=>{
				const args = ['./aktAPI/cleanupKnownHosts.sh',ip];
				const cleanup = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD});
				cleanup.stdout.on('data',d=>{
					console.log('cleanup stdout',ip,d.toString())
				})
				cleanup.stderr.on('data',d=>{
					console.log('cleanup stderr',ip,d.toString())
				})
				cleanup.on('close',()=>{
					finished++;
					if(finCount == finished){
						resolve();
					}
				})
			})
			
		})
	}
	postInitNewCluster(socketIONamespace,masterNodeName,masterUser,masterIP,masterMDNS,ingressNodeName){
		///./postInitK8sCluster.sh ansible akashnode1.local akashnode1 192.168.0.17
		return new Promise((resolve,reject)=>{

			const args = ['./aktAPI/postInitK8sCluster.sh',masterUser,masterMDNS,ingressNodeName,masterIP];
			const postProcess = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD});
			postProcess.stdout.on('data',d=>{
				socketIONamespace.to('akt').emit('k8sBuildLogs','POST INSTALL: '+d.toString());
			})
			postProcess.stderr.on('data',d=>{
				socketIONamespace.to('akt').emit('k8sBuildLogs','POST INSTALL: '+d.toString());
			})
			postProcess.on('close',()=>{
				this.installMetricsServer(socketIONamespace).then(()=>{
					resolve();
				})
				
			})
		})
		
	}
	fetchMetricsServerYaml(url,resolve,reject){
		let output = '';
		const request = https.get(url,response=>{
			response.on('data', (chunk) => {
				output += chunk;
			});
			if(response.statusCode.toString() == '301' || response.statusCode.toString() == '302'){
				//something went wrong
				return this.fetchMetricsServerYaml(response.headers.location, resolve, reject)
			}
			//the whole response has been received, so we just print it out here
			response.on('end', () => {
				resolve(output);
			});

			
		});
	}
	installMetricsServer(socketIONamespace){
		return new Promise((installResolve,installReject)=>{
			new Promise((resolve,reject)=>{
				const url = 'https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml';
				
				this.fetchMetricsServerYaml(url,resolve,reject);
				
			}).then(data=>{
				const parsed = yaml.loadAll(data);
				let output = [];
				parsed.map(d=>{
					
					let args = [];
					try{
						if(typeof d.spec.template.spec.containers != "undefined"){
						  	args = 	d.spec.template.spec.containers[0].args;
						}
					}
					catch(e){
						//console.log('no args defined',e);
					}
					//console.log('args',args);
					if(args.length > 0){
						if(args.indexOf('--kubelet-insecure-tls') == -1){
							args.push('--kubelet-insecure-tls');
						}
						d.spec.template.spec.containers[0].args = args;
					}
					output.push(yaml.dump(d));
				});
				socketIONamespace.to('akt').emit('k8sBuildLogs','Setting up Metrics Server');
				fs.writeFileSync(process.env.HOME+'/.HandyHost/aktData/akash_cluster_resources/metrics-server-handyhost.yaml',output.join('---\n'),'utf8');
				const applyKubectl = spawn('./installMetricsServer.sh',[],{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
				applyKubectl.stdout.on('data',d=>{
					socketIONamespace.to('akt').emit('k8sBuildLogs','POST INSTALL: '+d.toString());
				})
				applyKubectl.stderr.on('data',d=>{
					socketIONamespace.to('akt').emit('k8sBuildLogs','POST INSTALL: '+d.toString());
				})
				applyKubectl.on('close',()=>{
					installResolve();
				})
			}).catch(err=>{
				console.log('error',err);
				installReject();
			})
		});
	}
	teardownOldCluster(socketIONamespace){
		return new Promise((resolve,reject)=>{
			const args = []
			const teardown = spawn('./teardownK8sCluster.sh',args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
			teardown.stdout.on('data',d=>{
				socketIONamespace.to('akt').emit('k8sBuildLogs',d.toString());
			});
			teardown.stderr.on('data',d=>{
				console.log('teardown err',d.toString());
				socketIONamespace.to('akt').emit('k8sBuildLogs',d.toString());
			});
			teardown.on('close',()=>{
				console.log('teardown close');
				resolve({success:true})
			})
		});
	}
	initNewCluster(socketIONamespace){
		return new Promise((resolve,reject)=>{
			const args = ['./aktAPI/initK8sCluster.sh']
			const init = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD});
			init.stdout.on('data',d=>{
				socketIONamespace.to('akt').emit('k8sBuildLogs',d.toString());
			});
			init.stderr.on('data',d=>{
				socketIONamespace.to('akt').emit('k8sBuildLogs',d.toString());
			});
			init.on('close',()=>{
				//TODO: copy kubernetes access keys locally, 
				//install ansible locally,
				//make stats do things
				resolve({success:true})
			})
		});
	}
	getClusterStats(){
		return new Promise((resolve,reject)=>{
			const config = JSON.parse(fs.readFileSync(this.configJSONPath,'utf8'));
			if(typeof config.nodes != "undefined"){
				let targetNames = config.nodes.filter(node=>{
					if(typeof node.kubernetes == "undefined"){
						return false;
					}
					return true;
				}).map(node=>{
					return node.kubernetes.name;
				});
				if(targetNames.length == 0){
					resolve([]);
				}
				let finished = 0;
				let output = [];
				targetNames.map(name=>{
					this.getNodeStats(name).then(data=>{
						output.push(data);
						finished++;
						if(finished == targetNames.length){
							//now get realtime stats
							const realtimeArgs = ['./aktAPI/getK8sTop.sh'];
							let topOutput = '';
							const top = spawn('bash',realtimeArgs,{shell:true,env:process.env,cwd:process.env.PWD});
							top.stdout.on('data',d=>{
								topOutput += d.toString();
							})
							top.on('close',()=>{
								/*
								NAME                        CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%   
								akash-blue-gratis-texture   292m         3%     1215Mi          19%
								*/
								//let topData = {};
								let headers = [];
								topOutput.split('\n').filter(line=>{
									return line != '';
								}).map((line,i)=>{
									let cells = line.split(' ').filter(cell=>{
										return cell.trim() != '';
									}).map(cell=>{
										return cell.trim();
									})
									if(i == 0){
										//is headers
										headers = cells.slice(0).map(cell=>{
											return cell.toLowerCase();
										});
									}
									else{
										let record = {};
										let name = cells[0];
										cells.map((val,valI)=>{
											record[headers[valI]] = val;
										});
										output.map(outRec=>{
											if(outRec.name == name){
												outRec.realtime = record;
											}
										})
										//topData.push(record);
									}
								});
								let podsOut = '';
								const getPods = spawn('bash',['./aktAPI/getRunningPodList.sh'],{shell:true,env:process.env,cwd:process.env.PWD});
								getPods.stdout.on('data',d=>{
									podsOut += d.toString();
								})
								getPods.on('close',d=>{
									let json = {items:[]};
									try{
										json = JSON.parse(podsOut);
									}
									catch(e){

									}
									let itemsOut = {};
									let ignoreNS = [
										'ingress-nginx',
										'kube-system'
									]
									json.items.map(pod=>{
										if(ignoreNS.indexOf(pod.metadata.namespace) >= 0){
											return;
										}
										const machine = pod.spec.nodeName;
										if(typeof itemsOut[machine] == "undefined"){
											itemsOut[machine] = 0;
										}
										itemsOut[machine] += 1;
									});
									output.map(outRec=>{
										if(typeof outRec.realtime == "undefined"){
											outRec.realtime = {};
										}
										if(typeof itemsOut[outRec.name] != "undefined"){
											outRec.realtime.pods = itemsOut[outRec.name];
										}
										else {
											outRec.realtime.pods = 0;
										}
									})
									resolve(output);
								})
								
							})
							
						}
					});
				})
			}
			else{
				resolve([]);
			}
			
		})
	}
	getNodeStats(nodeName){
		return new Promise((resolve,reject)=>{
			const args = ['./aktAPI/getK8sClusterStats.sh',nodeName];
			const getStats = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD});
			let output = '';
			let errOut = '';
			getStats.stdout.on('data',d=>{
				output += d.toString();
			});
			getStats.stderr.on('data',d=>{
				errOut += d.toString();
			})
			getStats.on('close',()=>{
				//parse it
				/*
				
				*/
				//console.log('node top stats errOut??',errOut,output);
				let sections = {};
				let allocatedVals = [];
				let allocatedHeaders = [];

				output.split('\n\n').map(section=>{
					//console.log('section',section);
					let sectionTitle = '';
					let sectionParts = {};
					
					if(section.trim().length == 0){
						return;
					}
					let hasOverflowed = false;
					section.split('\n').filter(line=>{return line.trim().length > 0;}).map((line,i)=>{
						//console.log('line is',line,i);
						if(i == 0){
							sectionTitle = line.replace(':','').trim();
							if(sectionTitle.toLowerCase() == 'allocated resources'){
								allocatedVals = [];
								allocatedHeaders = [];
							}
							return;
						}
						else{
							//if there is overflow from the next section forget it...
							if(line.indexOf(' ') > 0 || line.indexOf(' ') == -1){
								hasOverflowed = true;
							}
						}
						if(hasOverflowed){
							return;
						}
						//else{
						if(sectionTitle.toLowerCase() == 'allocated resources'){
							//treat special
							if((line.indexOf('(') >= 0 && line.indexOf(')') >= 0 && allocatedHeaders.length == 0) || line.indexOf('-----') >= 0 || line.indexOf('Events:') >= 0){
								//bust
								return;
							}
							else{
								let vals = line.trim().split('  ').filter(p=>{
									return p.trim().length > 0;
								})
								//console.log('vals',vals);
								if(allocatedHeaders.length == 0){
									//should be our headers..
									vals.map((val)=>{
										allocatedHeaders.push(val.trim());
									})
									//console.log('set headers',allocatedHeaders);
								}
								else{
									//console.log('alloc vals',vals);
									//is vals
									let allocatedParts = {};
									vals.map((val,ii)=>{
										allocatedParts[allocatedHeaders[ii]] = val.trim();
									});
									allocatedVals.push(allocatedParts);
								}
							}
						}
						else{
							let parts = line.trim().split(':').map(v=>{
								return v.trim();
							});
							sectionParts[parts[0]] = parts[1];
						}
						//}
					});
					if(sectionTitle.toLowerCase() == 'allocated resources'){
						sections[sectionTitle] = allocatedVals;
					}
					else{
						sections[sectionTitle] = sectionParts;
					}
					
				});
			
				resolve({
					name:nodeName,
					sections
				})
				
				
			})
		})
	}
	getProviderDetail(){
		//https://api.ipify.org?format=json
		return new Promise((resolve,reject)=>{
			let config = JSON.parse(fs.readFileSync(this.configJSONPath,'utf8'));
			if(typeof config.provider == "undefined"){
				resolve({})
			}
			else{
				resolve(config.provider);
			}
		});
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
	getLocalIP(){
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
				resolve(ipOut);
			});
		})
	}
	flashThumbDrive(path,pw){
		//path = device path. first verify it's detachable media just to be paranoid..
		return new Promise((resolve,reject)=>{
			let shouldProceed = false;
			const method = process.platform == 'darwin' ? this.diskUtils.getUSBFromDiskUtil : this.diskUtils.getThumbDrives;
			method().then(usbDrives=>{
				let devicePath;
				usbDrives.map(usb=>{
					if(usb.meta.device == path && usb.rm){
						//is removable
						devicePath = usb.meta.path;
						shouldProceed = true;
					}
				})

				if(!shouldProceed){
					reject('error');
					return;
				}
				else{
					//ok lets flash the drive then
					if(typeof devicePath != "undefined"){
						this.createUbuntuISO(devicePath,pw).then(data=>{
							resolve(data)
						})
					}
					else{
						reject('error');
					}
				}
			});
		});
	}
	createUbuntuISO(devicePath,pw){
		return new Promise((resolve,reject)=>{
			this.generateSSHKey().then(()=>{
				//done
				this.getLocalIP().then((ip)=>{
					this.getRandomPW().then((randomPW)=>{
						const ssh_pub_key = fs.readFileSync(process.env.HOME+'/.ssh/handyhost.pub','utf8');
						const cloudInitTemplate = fs.readFileSync('./aktAPI/ubuntu-cloud-config-x86','utf8');
						
						let cloudInitOutput = cloudInitTemplate.replace(/__SSH_PUB_KEY__/g,ssh_pub_key.trim());
						cloudInitOutput = cloudInitOutput.replace(/__HOST_IP__/g,ip.trim());
						cloudInitOutput = cloudInitOutput.replace(/__PASSWORD__/g,randomPW.trim());
						//cloudInitOutput = cloudInitOutput.replace(/__SSH_PUB_KEY__/g,ssh_pub_key);
						//3. write the config
						const generatorPath = process.env.HOME+'/.HandyHost/aktData/ubuntu-autoinstall-generator';

						fs.writeFileSync(generatorPath+'/user-data',cloudInitOutput,'utf8');
						//ok now to generate the ISO...
						console.log('device path',devicePath);
						let args = ['./aktAPI/generateUbuntuAutoinstallerISO.sh'];
						if(process.platform == 'darwin'){
							args = ['./aktAPI/generateUbuntuAutoinstallerISO_MAC.sh'];
						}
						let output = '';
						let errs = '';
						const autogen = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD});
						autogen.stdout.on('data',d=>{
							console.log('autogen stdout output: ',d.toString());
							output += d.toString();
						})
						autogen.stderr.on('data',d=>{
							//ofc it dumps everything to stderr...
							console.log('autogen stderr output: ',d.toString());
							errs += d.toString();
						})
						autogen.on('close',()=>{
							if(fs.existsSync(generatorPath+'/ubuntu-autoinstaller.iso')){
								//ok it wrote it then, lets continue
								const chunkSize = process.platform == 'darwin' ? '4m' : '4M';
								console.log('device path',devicePath,generatorPath);
								let script = './aktAPI/flashUbuntuISO.sh';
								if(process.platform == 'darwin'){
									script = './aktAPI/flashUbuntuISO_MAC.sh';
								}

								let ddArgs = [
									script,//'./aktAPI/flashUbuntuISO.sh',
									devicePath,
									chunkSize
								];
								if(process.platform == 'darwin'){
									ddArgs.push(this.commonUtils.escapeBashString(pw)); //dd needs sudo on mac
								}
								let ddOut = '';
								let ddErr = '';
								
								const dd = spawn('bash',ddArgs,{shell:true,env:process.env,cwd:process.env.PWD});

								dd.stdout.on('data',d=>{
									console.log('dd stdout output: ',d.toString());
									ddOut += d.toString();
								})
								dd.stderr.on('data',d=>{
									console.log('dd stderr output: ',d.toString());
									ddErr += d.toString();
								})
								dd.on('close',()=>{
									if(ddErr.indexOf('records in') == -1 && ddErr.indexOf('records out') == -1 && ddErr.indexOf('bytes') == -1 && ddErr.indexOf('copied') == -1){
										//is a real error
										reject({error:ddErr})
									}
									else{
										resolve({success:true})
									}
								})
							}
							else{
								resolve({error:errs})
							}
							
						})
						
					})
					
				})
				
			})
		})
	}
	getRandomPW(){
		//mkpasswd -m sha-512 1234
		return new Promise((resolve,reject)=>{
			let output = '';
			if(process.platform != 'darwin'){
				const mkpasswd = spawn('mkpasswd',['-m','sha-512',Math.floor(new Date().getTime() * Math.random())])
				mkpasswd.stdout.on('data',d=>{
					output += d.toString();
				});
				mkpasswd.on('close',()=>{
					resolve(output);
				})
			}
			else{
				//on mac there is no mkpasswd...
				const mkpasswd0 = spawn('slappasswd',['-g'])
				mkpasswd0.stdout.on('data',d=>{
					output += d.toString();
				});
				mkpasswd0.on('close',()=>{
					const mkpasswd1 = spawn('slappasswd',['-g'])
					mkpasswd1.stdout.on('data',d=>{
						output += d.toString();
					});
					mkpasswd1.on('close',()=>{
						//resolve(output);
						const mkpasswd2 = spawn('slappasswd',['-g'])
						mkpasswd2.stdout.on('data',d=>{
							output += d.toString();
						});
						mkpasswd2.on('close',()=>{
							resolve(output);
						})
					})
					//resolve(output);
				})
			}
		})
	}
	addUbuntuAutoinstalledNode(ipAddress,moniker,socketIONamespace){
		//ok thumbdrive flashed ubuntu onto a new node.
		//that node contacted us to acquire a hostname
		//so we need to add it to the configs now

		const clusterConfig = JSON.parse(fs.readFileSync(this.configJSONPath,'utf8'));
		
		if(typeof clusterConfig.preConfiguredNVMe == "undefined"){
			clusterConfig.preConfiguredNVMe = {};
		}

		clusterConfig.preConfiguredNVMe[moniker] = {
			hostname:moniker,
			path:null,
			ip:ipAddress,
			reservedNetworkHost:moniker+'.local',
			isDiskConfigured:true
		}
		fs.writeFileSync(this.configJSONPath,JSON.stringify(clusterConfig),'utf8');
		console.log('added node to config',ipAddress,moniker);
		setTimeout(()=>{
			//give the USB time to unmount and the node time to restart..
			socketIONamespace.to('akt').emit('newNodeRegistered',clusterConfig.preConfiguredNVMe[moniker],clusterConfig);
		},30000);
		
		//TODO socket io message about this new node
	}
}