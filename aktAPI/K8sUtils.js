import fs from 'fs';
import {spawn} from 'child_process';
import https from 'https';

export class K8sUtils{
	constructor(configPath){
		this.configJSONPath = configPath; //the json for handyhost app about the cluster inventory
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
			let ingressNode = '';//no roles is ingress

			configJSON.nodes.map((node,i)=>{
			    //let name = node.hostname == '?' : 'akashnode'+i : node.hostname.split('.local')[0];
				let name = node.kubernetes.name;
				if(node.kubernetes.role == 'master'){
					masterNodeName = name;
					masterUser = node.user;
					masterIP = node.ip;
					masterMDNS = node.hostname;
				}
				if(node.kubernetes.role == 'etcd'){
					etcdNodeName = name;
				}
				if(node.kubernetes.role == 'none'){
					ingressNode = name;
				}
				if(node.kubernetes.isCompute){
					nodeNames.push(name);
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
					this.postInitNewCluster(socketIONamespace,masterNodeName,masterUser,masterIP,masterMDNS,ingressNode).then(()=>{
						socketIONamespace.to('akt').emit('k8sBuildLogStatus',{part:'init',status:'finished'})
						resolve({success:true})
					})
					
				})
			})
			resolve({config});
		}).catch(error=>{
			reject(error);
		});
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
				resolve();
			})
		})
		
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
				let finished = 0;
				let output = [];
				targetNames.map(name=>{
					this.getNodeStats(name).then(data=>{
						output.push(data);
						finished++;
						if(finished == targetNames.length){
							resolve(output);
						}
					});
				})
			}
			
		})
	}
	getNodeStats(nodeName){
		return new Promise((resolve,reject)=>{
			const args = ['./aktAPI/getK8sClusterStats.sh',nodeName];
			const getStats = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD});
			let output = '';
			getStats.stdout.on('data',d=>{
				output += d.toString();
			});
			getStats.on('close',()=>{
				//parse it
				/*
				
				*/
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
}