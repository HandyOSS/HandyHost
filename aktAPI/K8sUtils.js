import fs from 'fs';
import {spawn} from 'child_process';
import https from 'https';
import {DiskUtils} from './DiskUtils.js';
import yaml from 'js-yaml';
import {CommonUtils} from '../CommonUtils.js';
import {createHash} from 'crypto';

export class K8sUtils{
	constructor(configPath,walletUtils){
		this.walletUtils = walletUtils;
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
	getExistingKubernetesInventory(configPath){
		return new Promise((resolve,reject)=>{
			const inventoryFile = process.env.HOME+'/.HandyHost/aktData/kubespray/inventory/handyhost/myinventory.yaml';
			let output = {
				add:[],
				remove:[],
				didEtcdChange:false,
				didMasterChange:false
			}
			const isConfigured = fs.existsSync(inventoryFile);
			console.log('is k8s already configured?',isConfigured);
			if(isConfigured){
				const doc = yaml.loadAll(fs.readFileSync(inventoryFile))
				let yamlNodesObj = {};
				let yamlMaster = {};
				let yamlEtcd = {};

				try{
					yamlNodesObj = doc[0].all.hosts;
					yamlMaster = doc[0].all.children.kube_control_plane;
					yamlEtcd = doc[0].all.children.etcd;

				}
				catch(e){
					console.log('error parsing inventory.yaml',e);
				}

				
				const configJSON = JSON.parse(fs.readFileSync(configPath,'utf8'));
				let newNodes = {};
				console.log('yaml nodes',yamlNodesObj);
				console.log('configJSON nodes',configJSON.nodes);
				if(typeof configJSON.nodes != "undefined"){
					configJSON.nodes.filter(node=>{
						return typeof node.kubernetes != "undefined";
					}).map(node=>{
						newNodes[node.kubernetes.name] = node;
						if(typeof yamlNodesObj[node.kubernetes.name] == "undefined"){
							//new node was added
							output.add.push(node.kubernetes.name);
							if(node.kubernetes.role == 'etcd'){
								//check if its a new etcd
								if(typeof yamlEtcd[node.kubernetes.name] == "undefined"){
									output.didEtcdChange = true;
								}
							}
							if(node.kubernetes.role == 'master'){
								if(typeof yamlMaster[node.kubernetes.name] == "undefined"){
									output.didMasterChange = true;
								}
							}
						}
					});
					Object.keys(yamlNodesObj).map(nodeName=>{
						if(typeof newNodes[nodeName] == "undefined"){
							//needs removed
							output.remove.push(nodeName);
						}
					})

				}
			}
			resolve(output);
		})
		
	}
	createKubernetesInventory(configPath,socketIONamespaces,customEmitMessage){
		return new Promise((resolve,reject)=>{
			this.getExistingKubernetesInventory(configPath).then(nodeChanges=>{
				console.log('k8s node changes',nodeChanges);
				const configJSON = JSON.parse(fs.readFileSync(configPath,'utf8'));
				//take configJSON and make k8s inventory
				let tab = '  ';
				let config = 'all:\n';
				config += `${tab}vars:\n`;
				config += `${tab}${tab}cluster_id: "1.0.0.1"\n`;
				config += `${tab}${tab}gvisor_enabled: true\n`;
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
					if(typeof node.kubernetes.role != "undefined"){
						//support legacy "role" property
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
					}
					else{
						//however we move to a structure where i can be both master and etcd (single node cluster)
						//and later scale up to more nodes and not break things
						if(node.kubernetes.isMaster){
							masterNodeName = name;
							masterUser = node.user;
							masterIP = node.ip;
							allIPs.push(node.ip);
							masterMDNS = node.hostname;
						}
						if(node.kubernetes.isEtcd){
							etcdNodeName = name;
						}
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
	 				   entry += `${tab}${tab}${tab}access_ip: ${node.ip}\n`;
	 				   entry += `${tab}${tab}${tab}ip: ${node.ip}\n`;
					config += entry;
				})

				config += `${tab}children:\n`;
				config += `${tab}${tab}kube_control_plane:\n`
				config += `${tab}${tab}${tab}hosts:\n`;
				config += `${tab}${tab}${tab}${tab}${masterNodeName}:\n`;
				config += `${tab}${tab}etcd:\n`;
				config += `${tab}${tab}${tab}hosts:\n`;
				config += `${tab}${tab}${tab}${tab}${etcdNodeName}:\n`
				config += `${tab}${tab}kube_node:\n`;
				config += `${tab}${tab}${tab}hosts:\n`;
				nodeNames.map(name=>{
					config += `${tab}${tab}${tab}${tab}${name}:\n`;
				});
				/*config += `${tab}${tab}calico-rr:\n`;
				config += `${tab}${tab}${tab}hosts:\n`;
				nodeNames.map(name=>{
					config += `${tab}${tab}${tab}${tab}${name}:\n`;
				});*/
				
				config += `${tab}${tab}k8s_cluster:\n`;
				config += `${tab}${tab}${tab}children:\n`;
				config += `${tab}${tab}${tab}${tab}kube_control_plane:\n`;
				config += `${tab}${tab}${tab}${tab}kube_node:\n`;
				config += `${tab}${tab}calico_rr:\n`;
				config += `${tab}${tab}${tab}hosts:{}\n`

				console.log('built config',config);
				const emitMessage = typeof customEmitMessage == "undefined" ? 'k8sBuildLogStatus' : customEmitMessage;
				fs.writeFileSync(process.env.HOME+'/.HandyHost/aktData/inventory.yaml',config,'utf8');
				this.teardownOldCluster(socketIONamespaces,customEmitMessage).then(()=>{
					Object.keys(socketIONamespaces).map(serverName=>{
						socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,{part:'teardown',status:'finished'});
					})
					//socketIONamespace.to('akt').emit(emitMessage,{part:'teardown',status:'finished'})
					
					this.initNewCluster(socketIONamespaces,customEmitMessage).then(()=>{
						this.cleanupKnownHosts(allIPs).then(()=>{
							//add or remove nodes if we need to
							this.addOrRemoveClusterNodes(nodeChanges,socketIONamespaces).then(()=>{		
								this.postInitNewCluster(socketIONamespaces,masterNodeName,masterUser,masterIP,masterMDNS,ingressNode,customEmitMessage).then(()=>{
									Object.keys(socketIONamespaces).map(serverName=>{
										socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,{part:'init',status:'finished'})
									})
									//socketIONamespace.to('akt').emit(emitMessage,{part:'init',status:'finished'})
									if(typeof customEmitMessage != "undefined"){
										resolve({success:true})
									}
								});
							}).catch(error=>{
								console.log('error adding cluster nodes',error);
							})
						});
						
						
					})
				})
				if(typeof customEmitMessage == "undefined"){
					resolve({config});
				}
			}).catch(changeErr=>{
				console.log('error getting node changes in k8s inventory',changeErr);
			})
			
		}).catch(error=>{
			console.log('error init cluster',error);
		});
	}
	addOrRemoveClusterNodes(nodeChanges,socketIONamespaces){
		//remove is taken care of during reset.yml?
		return new Promise((resolve,reject)=>{
			let success = 0;
			if(nodeChanges.add.length > 0){
				if(nodeChanges.add.length > 0){
					nodeChanges.add.map(nodeName=>{
						console.log('adding kubernetes node',nodeName);
						const p = spawn('./addK8sClusterNode.sh',[nodeName],{env:process.env,cwd:process.env.PWD+'/aktAPI'});
						p.stderr.on('data',d=>{
							console.log('kubernetes error adding cluster node',d.toString());
							Object.keys(socketIONamespaces).map(serverName=>{
								socketIONamespaces[serverName].namespace.to('akt').emit('k8sBuildLogs','K8S Add Node Error: '+d.toString())
							})
							
						})
						p.stdout.on('data',d=>{
							Object.keys(socketIONamespaces).map(serverName=>{
								socketIONamespaces[serverName].namespace.to('akt').emit('k8sBuildLogs','K8S Add Node: '+d.toString())
							})
							
						})
						p.on('close',d=>{
							Object.keys(socketIONamespaces).map(serverName=>{
								socketIONamespaces[serverName].namespace.to('akt').emit('k8sBuildLogs','K8S Add Node Success: '+nodeName)
							})
							success += 1;
							if(success == nodeChanges.add.length){
								resolve();
							}
						})
						
					})
				}
				
			}
			else{
				resolve();
			}
		});
		
	}
	checkForKubesprayUpdates(){
		return new Promise((resolve,reject)=>{
			let out = '';
			const c = spawn('./getKubesprayLatestVersion.sh',[],{env:process.env,cwd:process.env.PWD+'/aktAPI'})
			c.stdout.on('data',d=>{
				out += d.toString();
			})
			c.stderr.on('data',d=>{
				console.log('error fetching kubespray latest version',d.toString());
				reject(d.toString());
			})
			c.on('close',()=>{
				let json = {};
				try{
					json = JSON.parse(out);
				}
				catch(e){
					reject(e);
				}
				resolve(json);

			})
		})
	}
	cleanupKnownHosts(allIPs){
		return new Promise((resolve,reject)=>{
			let finished = 0;
			const finCount = allIPs.length;
			allIPs.map(ip=>{
				const command = './aktAPI/cleanupKnownHosts.sh';
				const args = [ip];
				const cleanup = spawn(command,args,{env:process.env,cwd:process.env.PWD});
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
	postInitNewCluster(socketIONamespaces,masterNodeName,masterUser,masterIP,masterMDNS,ingressNodeName,customEmitMessage){
		///./postInitK8sCluster.sh ansible akashnode1.local akashnode1 192.168.0.17
		return new Promise((resolve,reject)=>{
			const command = './postInitK8sCluster.sh'
			const emitMessage = typeof customEmitMessage == "undefined" ? 'k8sBuildLogs' : customEmitMessage;
			const args = [masterUser,masterMDNS,ingressNodeName,masterIP];
			const postProcess = spawn(command,args,{env:process.env,cwd:process.env.PWD+'/aktAPI'});
			postProcess.stdout.on('data',d=>{
				Object.keys(socketIONamespaces).map(serverName=>{
					socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,'POST INSTALL: '+d.toString());
				})
				//socketIONamespace.to('akt').emit(emitMessage,'POST INSTALL: '+d.toString());
			})
			postProcess.stderr.on('data',d=>{
				Object.keys(socketIONamespaces).map(serverName=>{
					socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,'POST INSTALL: '+d.toString());
				})
				//socketIONamespace.to('akt').emit(emitMessage,'POST INSTALL: '+d.toString());
			})
			postProcess.on('close',()=>{
				this.installMetricsServer(socketIONamespaces,customEmitMessage).then(()=>{
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
	installMetricsServer(socketIONamespaces,customEmitMessage){
		return new Promise((installResolve,installReject)=>{
			const emitMessage = typeof customEmitMessage == "undefined" ? 'k8sBuildLogs' : customEmitMessage;
			
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
							//only for metrics on my local network.
							args.push('--kubelet-insecure-tls');
						}
						d.spec.template.spec.containers[0].args = args;
					}
					output.push(yaml.dump(d));
				});
				Object.keys(socketIONamespaces).map(serverName=>{
					socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,'Setting up Metrics Server');
				})
				//socketIONamespace.to('akt').emit('k8sBuildLogs','Setting up Metrics Server');
				fs.writeFileSync(process.env.HOME+'/.HandyHost/aktData/akash_cluster_resources/metrics-server-handyhost.yaml',output.join('---\n'),'utf8');
				const applyKubectl = spawn('./installMetricsServer.sh',[],{env:process.env,cwd:process.env.PWD+'/aktAPI'});
				
				applyKubectl.stdout.on('data',d=>{
					Object.keys(socketIONamespaces).map(serverName=>{
						socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,'POST INSTALL: '+d.toString());
					})
					//socketIONamespace.to('akt').emit('k8sBuildLogs','POST INSTALL: '+d.toString());
				})
				applyKubectl.stderr.on('data',d=>{
					Object.keys(socketIONamespaces).map(serverName=>{
						socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,'POST INSTALL: '+d.toString());
					})
					//socketIONamespace.to('akt').emit('k8sBuildLogs','POST INSTALL: '+d.toString());
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
	teardownOldCluster(socketIONamespaces,customEmitMessage){
		return new Promise((resolve,reject)=>{
			const args = []
			const emitMessage = typeof customEmitMessage == "undefined" ? 'k8sBuildLogs' : customEmitMessage;
			const teardown = spawn('./teardownK8sCluster.sh',args,{env:process.env,cwd:process.env.PWD+'/aktAPI'});
			teardown.stdout.on('data',d=>{
				Object.keys(socketIONamespaces).map(serverName=>{
					socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,d.toString());
				})
				//socketIONamespace.to('akt').emit(emitMessage,d.toString());
			});
			teardown.stderr.on('data',d=>{
				console.log('teardown err',d.toString());
				Object.keys(socketIONamespaces).map(serverName=>{
					socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,d.toString());
				})
				//socketIONamespace.to('akt').emit(emitMessage,d.toString());
			});
			teardown.on('close',()=>{
				console.log('teardown close');
				resolve({success:true})
			})
		});
	}
	initNewCluster(socketIONamespaces,customEmitMessage){
		return new Promise((resolve,reject)=>{
			const command = './aktAPI/initK8sCluster.sh';
			const args = [];
			const emitMessage = typeof customEmitMessage == "undefined" ? 'k8sBuildLogs' : customEmitMessage;
			const init = spawn(command,args,{env:process.env,cwd:process.env.PWD});
			init.stdout.on('data',d=>{
				Object.keys(socketIONamespaces).map(serverName=>{
					socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,d.toString());
				})
				//socketIONamespace.to('akt').emit(emitMessage,d.toString());
			});
			init.stderr.on('data',d=>{
				Object.keys(socketIONamespaces).map(serverName=>{
					socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,d.toString());
				})
				//socketIONamespace.to('akt').emit(emitMessage,d.toString());
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
							const command = './aktAPI/getK8sTop.sh';
							const realtimeArgs = [];
							let topOutput = '';
							const top = spawn(command,realtimeArgs,{env:process.env,cwd:process.env.PWD});
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
								const getPods = spawn('./aktAPI/getRunningPodList.sh',[],{env:process.env,cwd:process.env.PWD});
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
										'kube-system',
										'akash-services'
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
			const args = [nodeName];
			const getStats = spawn('./aktAPI/getK8sClusterStats.sh',args,{env:process.env,cwd:process.env.PWD});
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
	flashThumbDrive(path,pw,diskID,ioNamespaces){
		//path = device path. first verify it's detachable media just to be paranoid..
		return new Promise((resolve,reject)=>{
			let shouldProceed = false;
			const method = process.platform == 'darwin' ? this.diskUtils.getUSBFromDiskUtil : this.diskUtils.getThumbDrivesNEW;
			const _this = this;
			checkDrives(false,path,pw,diskID);
			function checkDrives(hasAlreadyChecked,path,pw,diskID){
				method().then(usbDrives=>{
					let devicePath;
					let needsRemounted = false;
					usbDrives.map(usb=>{
						if(usb.meta.device == path && usb.rm){
							//is removable
							devicePath = usb.meta.path;
							shouldProceed = true;
						}
						else if(!hasAlreadyChecked && process.platform == 'darwin' && typeof usb.meta.device == "undefined" && usb.rm && diskID == usb.meta.path){
							//its on mac and was previously unmounted, likely by failed dd invalid pw, lets mount it...
							needsRemounted = true;
							console.log('OSX: Re-Mounting drive '+diskID)
							
							const mount = spawn('diskutil',['mount',diskID]);
							mount.on('close',()=>{
								checkDrives(true,path,pw,diskID);
							})
						}
					})
					if(!needsRemounted){
						if(!shouldProceed){
							
							reject({error:'Error Mounting USB'});
							return;
						}
						else{
							//ok lets flash the drive then
							if(typeof devicePath != "undefined"){
								console.log("WILL MAKE ISO NOW",devicePath);
								_this.createUbuntuISO(devicePath,pw,ioNamespaces).then(data=>{
									resolve(data)
								}).catch(error=>{
									console.log('error creating usb',error);
									let message = error.error;
									if(message.indexOf('incorrect password attempt') >= 0){
										message = 'Incorrect Password';
									}
									reject({error:message});
								})
							}
							else{
								reject({error:'Error Mounting USB'});
							}
						}
					}
					
				});
			}
			
		});
	}
	createUbuntuISO(devicePath,pw,socketIONamespaces){
		return new Promise((resolve,reject)=>{
			this.generateSSHKey().then(()=>{
				//done
				this.getLocalIP().then((ip)=>{
					this.getRandomPW().then((randomPW)=>{
						const authToken = createHash('sha256').update( (Math.random() * ( new Date().getTime() )).toString() ).digest('hex');
						console.log('created auth token',authToken);
						fs.writeFileSync(process.env.HOME+'/.HandyHost/aktData/usbAuthToken',authToken.trim(),'utf8');
						const ssh_pub_key = fs.readFileSync(process.env.HOME+'/.ssh/handyhost.pub','utf8');
						const cloudInitTemplate = fs.readFileSync('./aktAPI/ubuntu-cloud-config-x86','utf8');
						
						let cloudInitOutput = cloudInitTemplate.replace(/__SSH_PUB_KEY__/g,ssh_pub_key.trim());
						cloudInitOutput = cloudInitOutput.replace(/__HOST_IP__/g,ip.trim());
						cloudInitOutput = cloudInitOutput.replace(/__USB_AUTH_TOKEN__/g,authToken.trim());
						cloudInitOutput = cloudInitOutput.replace(/__PASSWORD__/g,randomPW.trim());
						//cloudInitOutput = cloudInitOutput.replace(/__SSH_PUB_KEY__/g,ssh_pub_key);
						//3. write the config
						const generatorPath = process.env.HOME+'/.HandyHost/aktData/ubuntu-autoinstall-generator';

						fs.writeFileSync(generatorPath+'/user-data',cloudInitOutput,'utf8');
						//ok now to generate the ISO...
						console.log('device path',devicePath);
						let command = './aktAPI/generateUbuntuAutoinstallerISO.sh';
						if(process.platform == 'darwin'){
							command = './aktAPI/generateUbuntuAutoinstallerISO_MAC.sh';
						}
						let output = '';
						let errs = '';
						const autogen = spawn(command,[],{env:process.env,cwd:process.env.PWD});
						autogen.stdout.on('data',d=>{
							console.log('autogen stdout output: ',d.toString());
							Object.keys(socketIONamespaces).map(serverName=>{
								socketIONamespaces[serverName].namespace.to('akt').emit('flashUSBStatus',d.toString());
							})
							output += d.toString();
						})
						autogen.stderr.on('data',d=>{
							//ofc it dumps everything to stderr...
							console.log('autogen stderr output: ',d.toString());
							Object.keys(socketIONamespaces).map(serverName=>{
								socketIONamespaces[serverName].namespace.to('akt').emit('flashUSBStatus',d.toString());
							})
							errs += d.toString();
						})
						autogen.on('close',()=>{
							if(fs.existsSync(generatorPath+'/ubuntu-autoinstaller.iso')){
								//ok it wrote it then, lets continue
								const chunkSize = process.platform == 'darwin' ? '4m' : '4M';
								console.log('device path',devicePath,generatorPath);
								
								/*if(process.platform == 'darwin'){
									this.createUbuntuISOMAC(devicePath,pw,chunkSize,resolve,reject);
									return;
								}
								else{
									this.createUbuntuISOLinux(devicePath,pw,chunkSize,resolve,reject);
									return;
								}*/
								if(process.platform == 'darwin'){
									this.spawnCreateUbuntuISOMAC(devicePath,pw,chunkSize,resolve,reject,socketIONamespaces);
								}
								else{
									this.spawnCreateUbuntuISO(devicePath,pw,chunkSize,resolve,reject,socketIONamespaces);
								}
								
								return;
								
								
								
							}
							else{
								resolve({error:errs})
							}
							
						})
					
					}).catch(error=>{
						resolve({error:error})
					})
					
				}).catch(error=>{
					resolve({error:error})
				})
				
			}).catch(error=>{
				resolve({error:error})
			})
		})
	}
	spawnCreateUbuntuISO(devicePath,pw,chunkSize,resolve,reject,socketIONamespaces){
		const args = [
			'-S',
			'dd',
			`bs=${chunkSize}`,
			`if=${process.env.HOME}/.HandyHost/aktData/ubuntu-autoinstall-generator/ubuntu-autoinstaller.iso`,
			`of=${devicePath}`,
			'conv=fdatasync',
			'status=progress'
		]
		Object.keys(socketIONamespaces).map(serverName=>{
			socketIONamespaces[serverName].namespace.to('akt').emit('flashUSBStatus','HandyHost ISO creation done. Flashing ISO to USB.');
		})
		const dd = spawn('sudo',args);
		let ddOut = '';
		let ddErr = '';
		
		//const dd = spawn(command,ddArgs,{shell:true,env:process.env,cwd:process.env.PWD});
		dd.stdin.write(`${pw}\n`);
		dd.stdout.on('data',d=>{
			console.log('dd stdout output: ',d.toString());
			Object.keys(socketIONamespaces).map(serverName=>{
				socketIONamespaces[serverName].namespace.to('akt').emit('flashUSBStatus',d.toString());
			})
			ddOut += d.toString();
		})
		dd.stderr.on('data',d=>{
			console.log('dd stderr output: ',d.toString());
			Object.keys(socketIONamespaces).map(serverName=>{
				socketIONamespaces[serverName].namespace.to('akt').emit('flashUSBStatus',d.toString());
			})
			ddErr += d.toString();
			if(ddErr.indexOf('incorrect password attempt') >= 0){
				dd.kill();
			}
		})
		dd.stdin.end();
		dd.on('close',()=>{
			//TODO: If mac: check for password success else throw specific error
			if(ddErr.indexOf('records in') == -1 && ddErr.indexOf('records out') == -1 && ddErr.indexOf('bytes') == -1 && ddErr.indexOf('copied') == -1){
				//is a real error
				reject({error:ddErr})
			}
			else{
				resolve({success:true})
			}
		})
		dd.on('error',()=>{
			console.log('dd died of error')
			let message = ddErr;
			if(ddErr.indexOf('incorrect password attempt') >= 0){
				message = 'Incorrect Password';
			}
			reject({error:message});
		})
	}
	spawnCreateUbuntuISOMAC(devicePath,pw,chunkSize,resolve,reject,socketIONamespaces){
		//big difference here is that mac needs to unmount the disk first...
		console.log('start mac flashing');
		Object.keys(socketIONamespaces).map(serverName=>{
			socketIONamespaces[serverName].namespace.to('akt').emit('flashUSBStatus','HandyHost ISO creation done. Flashing ISO to USB (this will take ~5 minutes)...');
		})
		const unmount = spawn('diskutil',['unmountDisk',devicePath]);
		unmount.on('close',()=>{
			console.log('unmounted disk, now flashing USB ISO (this will take ~5 minutes)...');
			const args = [
				'-S',
				'dd',
				`bs=${chunkSize}`,
				`if=${process.env.HOME}/.HandyHost/aktData/ubuntu-autoinstall-generator/ubuntu-autoinstaller.iso`,
				`of=${devicePath}`, 
				'conv=sync'
			]
			const dd = spawn('sudo',args);
			let ddOut = '';
			let ddErr = '';
			
			//const dd = spawn(command,ddArgs,{shell:true,env:process.env,cwd:process.env.PWD});
			dd.stdin.write(`${pw}\n`);
			dd.stdout.on('data',d=>{
				console.log('dd stdout output: ',d.toString());
				if(d.toString().toLowerCase().indexOf('password') == -1){
					Object.keys(socketIONamespaces).map(serverName=>{
						socketIONamespaces[serverName].namespace.to('akt').emit('flashUSBStatus',d.toString());
					})
				}
				ddOut += d.toString();
			})
			dd.stderr.on('data',d=>{
				console.log('dd stderr output: ',d.toString());
				if(d.toString().toLowerCase().indexOf('password') == -1){
					Object.keys(socketIONamespaces).map(serverName=>{
						socketIONamespaces[serverName].namespace.to('akt').emit('flashUSBStatus',d.toString());
					})
				}
				ddErr += d.toString();
				if(ddErr.indexOf('incorrect password attempt') >= 0){
					dd.kill();
				}
			})
			dd.stdin.end();
			dd.on('close',()=>{
				//TODO: If mac: check for password success else throw specific error
				if(ddErr.indexOf('records in') == -1 && ddErr.indexOf('records out') == -1 && ddErr.indexOf('bytes') == -1 && ddErr.indexOf('copied') == -1){
					//is a real error
					let message = ddErr;
					if(ddErr.indexOf('incorrect password attempt') >= 0){
						message = 'Incorrect Password';
					}
					reject({error:message})
				}
				else{
					resolve({success:true})
				}
			})
			dd.on('error',()=>{
				console.log('dd died of error')
				let message = ddErr;
				if(ddErr.indexOf('incorrect password attempt') >= 0){
					message = 'Incorrect Password';
				}
				reject({error:message});
			})
		});
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
	addUbuntuAutoinstalledNode(ipAddress,moniker,socketIONamespaces){
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
		let preconfiguredMonikers = {};
		const preconfiguredMonikersPath = process.env.HOME+'/.HandyHost/aktData/preconfiguredMonikers.json';
		if(fs.existsSync(preconfiguredMonikersPath)){
			preconfiguredMonikers = JSON.parse(fs.readFileSync(preconfiguredMonikersPath,'utf8'));
		}
		preconfiguredMonikers[moniker] = true;
		fs.writeFileSync(preconfiguredMonikersPath,JSON.stringify(preconfiguredMonikers,null,2),'utf8');
		console.log('added node to config',ipAddress,moniker);
		setTimeout(()=>{
			//give the USB time to unmount and the node time to restart..
			Object.keys(socketIONamespaces).map(serverName=>{
				socketIONamespaces[serverName].namespace.to('akt').emit('newNodeRegistered',clusterConfig.preConfiguredNVMe[moniker],clusterConfig);
			})
			//socketIONamespace.to('akt').emit('newNodeRegistered',clusterConfig.preConfiguredNVMe[moniker],clusterConfig);
		},30000);
		
		//TODO socket io message about this new node
	}
	updateKubespray(ioNamespaces){
		return new Promise((resolve,reject)=>{
			this.walletUtils.pauseProvider().then(()=>{
				console.log('provider is paused, do kubespray update')
				const p = spawn('./updateKubespray.sh',[],{env:process.env,cwd:process.env.PWD+'/aktAPI'});
				//emit kubesprayUpdateLogs
				p.stdout.on('data',d=>{
					Object.keys(ioNamespaces).map(serverName=>{
						ioNamespaces[serverName].namespace.to('akt').emit('kubesprayUpdateLogs','Kubespray: '+d.toString());
					})
				})
				p.stderr.on('data',d=>{
					Object.keys(ioNamespaces).map(serverName=>{
						ioNamespaces[serverName].namespace.to('akt').emit('kubesprayUpdateLogs','Kubespray: '+d.toString());
					})
				})
				p.on('close',()=>{
					console.log('done with kubespray update process');
					const configPath = this.configJSONPath;
					const inventoryExists = false;
					const inventoryPath = process.env.HOME+'/.HandyHost/aktData/kubespray/inventory/handyhost';

					let shouldSkipKubernetesRebuild = false;
					//if(!fs.existsSync(configPath)){
					if(!fs.existsSync(inventoryPath)){
						//we only want to skip if the inventory.yaml exists aka its been built before
						shouldSkipKubernetesRebuild = true;
					}
					else{
						//ok it has yaml inventory, make sure config has nodes present
						const config = JSON.parse(fs.readFileSync(configPath,'utf8'));
						let hasK8s = false;
						if(typeof config.nodes == "undefined"){
							shouldSkipKubernetesRebuild = true;
						}
						else{
							config.nodes.map(node=>{
								if(typeof node.kubernetes != "undefined"){
									hasK8s = true;
								}
							})
							if(!hasK8s){
								shouldSkipKubernetesRebuild = true;
							}
						}
					}
					if(shouldSkipKubernetesRebuild){
						console.log('skipping kubernetes rebuild, no nodes present')
						Object.keys(ioNamespaces).map(serverName=>{
							ioNamespaces[serverName].namespace.to('akt').emit('kubesprayUpdateLogs','Update Finished!',true);	
						});
						resolve({"updated":true})
						return;
					}
					this.createKubernetesInventory(configPath,ioNamespaces,'kubesprayUpdateLogs').then((status)=>{
						console.log('create kubernetes inventory done');
						this.walletUtils.unpauseProvider();
						Object.keys(ioNamespaces).map(serverName=>{
							setTimeout(()=>{
								//give provider a hot second to restart
								ioNamespaces[serverName].namespace.to('akt').emit('kubesprayUpdateLogs','UPDATE PROCESS COMPLETE',true);

							},15000);
							ioNamespaces[serverName].namespace.to('akt').emit('kubesprayUpdateLogs','Update Finished! Restarting Provider',true);
							
						})
						resolve(status);
						
					})
		
					/*Object.keys(ioNamespaces).map(serverName=>{
						ioNamespaces[serverName].namespace.to('akt').emit('kubesprayUpdateLogs','DONE UPDATING CLUSTER',true);
					})*/
				})
			});
		})
		
	}
	migrateToV016(socketIONamespaces){
		//migrate to v0.16.* of akash
		const emitMessage = typeof customEmitMessage == "undefined" ? 'k8sBuildLogs' : customEmitMessage;
		return new Promise((resolve,reject)=>{
			this.walletUtils.haltProvider().then(()=>{
				console.log('provider is paused, do kubespray update')
				//step0: stop provider DONE
				//step1: download latest akash
				Object.keys(socketIONamespaces).map(serverName=>{
					socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,'Halted Provider. Downloading Latest Akash.\n');
				})
				const args = ['./install.sh'];
				const updater = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
				updater.stdout.on('data',d=>{
					Object.keys(socketIONamespaces).map(serverName=>{
						socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,d.toString());
					})
					//socketIONamespace.to('akt').emit(emitMessage,d.toString());
				})
				updater.stderr.on('data',d=>{
					Object.keys(socketIONamespaces).map(serverName=>{
						socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,d.toString());
					})
					//socketIONamespace.to('akt').emit(emitMessage,d.toString());
				})
				updater.on('close',()=>{
					Object.keys(socketIONamespaces).map(serverName=>{
						socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,"Akash Binaries Updated. Updating Akash Provider CRD.\n");
					
					})
					//step 1.5: download latest akash repo
					const akashUpdate = spawn('bash',['./updateAkashRepo.sh'],{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
					akashUpdate.stdout.on('data',d=>{
						Object.keys(socketIONamespaces).map(serverName=>{
							socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,d.toString());
						})
					})
					akashUpdate.stderr.on('data',d=>{
						Object.keys(socketIONamespaces).map(serverName=>{
							socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,d.toString());
						})
					})
					akashUpdate.on('close',d=>{
						Object.keys(socketIONamespaces).map(serverName=>{
							socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,'Akash CRD Downloaded. Migrating Cluster.\n');
						})
						//step2: purge manifests
						const purgeCmd = spawn('./manifest-purge.sh',[],{env:process.env,cwd:process.env.PWD+'/aktAPI'});
						purgeCmd.stdout.on('data',d=>{
							Object.keys(socketIONamespaces).map(serverName=>{
								socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,d.toString());
							})
						})
						purgeCmd.stderr.on('data',d=>{
							Object.keys(socketIONamespaces).map(serverName=>{
								socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,d.toString());
							})
						})
						purgeCmd.on('close',d=>{
							Object.keys(socketIONamespaces).map(serverName=>{
								socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,"Done purging manifests. Now Installing CRD\n");
							})
							//step3: install crd
							const command = process.env.HOME+'/.HandyHost/aktData/bin/akash';
							const args = ['provider', 'migrate', 'v0.14tov0.16', '--crd', process.env.HOME+'/.HandyHost/aktData/akashRepo/pkg/apis/akash.network/crd.yaml','--kubeconfig',process.env.HOME+'/.HandyHost/aktData/admin.conf'];
							const migrate = spawn(command,args,{env:process.env,cwd:process.env.PWD});
							migrate.stdout.on('data',d=>{
								Object.keys(socketIONamespaces).map(serverName=>{
									socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,d.toString());
								})
								//socketIONamespace.to('akt').emit(emitMessage,d.toString());
							});
							migrate.stderr.on('data',d=>{
								Object.keys(socketIONamespaces).map(serverName=>{
									socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,d.toString());
								})
								//socketIONamespace.to('akt').emit(emitMessage,d.toString());
							});
							migrate.on('close',()=>{
								//ok finally do a postinstall to make sure ingress crd and kustomize routines get called........
								Object.keys(socketIONamespaces).map(serverName=>{
									socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,"v0.16.1 CRD was applied. Finally, we apply additional ingress CRDs and kustomize.\n");
								})
								const postMigrate = spawn('bash',['./postMigrateCRD.sh'],{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
								postMigrate.stdout.on('data',d=>{
									Object.keys(socketIONamespaces).map(serverName=>{
										socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,d.toString());
									})
								})
								postMigrate.stderr.on('data',d=>{
									Object.keys(socketIONamespaces).map(serverName=>{
										socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,d.toString());
									})
								})
								postMigrate.on('close',()=>{
									Object.keys(socketIONamespaces).map(serverName=>{
										socketIONamespaces[serverName].namespace.to('akt').emit(emitMessage,"FINISHED! You may now restart your provider.\n");
									})
									resolve({success:true})
								})
								
							})
						})
					})
					
				})
				
				
			});

		});
	}
}