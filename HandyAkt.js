import fs from 'fs';
import path from 'path';
import url from 'url';
import {spawn} from 'child_process';
import generator from 'project-name-generator';
import {AKTUtils} from './aktAPI/Utils.js';
import {DiskUtils} from './aktAPI/DiskUtils.js';
import {K8sUtils} from './aktAPI/K8sUtils.js';
import {Wallet} from './aktAPI/Wallet.js';
import {Marketplace} from './aktAPI/Marketplace.js';
import {CommonUtils} from './CommonUtils.js';

export class HandyAKT{
	constructor(){
		this.ioNamespaces = {};
		this.clusterConfigFilePath = process.env.HOME+'/.HandyHost/aktData/clusterConfig.json';
		try{
			fs.mkdirSync(`${process.env.HOME}/.HandyHost/aktData`,{recursive:true})
		}
		catch(e){
			//folder already exists
		}
		
		this.checkClusterConfigExistence();
		this.handyUtils = new CommonUtils();
		this.wallet = new Wallet();
		this.k8sUtils = new K8sUtils(this.clusterConfigFilePath,this.wallet);
		this.utils = new AKTUtils(this.clusterConfigFilePath,this.k8sUtils,this.wallet);
		this.diskUtils = new DiskUtils();
		
		
		this.market = new Marketplace();
		setTimeout(()=>{
			//give env time to spin up and get rpc node
			this.wallet.autostartProvider();

		},20000)
		
	}
	checkClusterConfigExistence(){
		if(!fs.existsSync(this.clusterConfigFilePath)){
			//init an empty config file
			fs.writeFileSync(this.clusterConfigFilePath,'{}','utf8');
		}
	}
	addSocketNamespace(ioNamespace,serverName){
		//console.log('init sia sockets');
		this.ioNamespaces[serverName] = {namespace:ioNamespace};
		this.ioNamespaces[serverName].namespace.adapter.on("create-room", (room) => {
		  if(room.indexOf('akt') == 0){
		  	//start a Socket listener for this room
		  	this.initSocketListener(room,serverName);
		  }
		});

		this.ioNamespaces[serverName].namespace.adapter.on("delete-room", (room) => {
		  //console.log(`room deleted ${room}`);
		  if(room.indexOf('akt') == 0){
		  	//stop a Socket listener for this room
		  	this.removeSocketListener(room,serverName);
		  }
		});
		/*this.ioNamespaces[serverName].adapter.on("join-room", (room, id) => {
		  console.log(`socket ${id} has joined room ${room}`);
		});
		this.ioNamespaces[serverName].adapter.on("leave-room", (room, id) => {
		  console.log(`socket ${id} has left room ${room}`);
		});*/
		this.ioNamespaces[serverName].namespace.on('connection',(socket)=>{
			this.addSocketConnection(socket);
		});
	}
	addSocketConnection(socket){
		socket.emit('register');
		socket.on('subscribe',()=>{
			socket.join('akt');
		})
		socket.on('getAppStatus',()=>{
			let status = {};
			//versionData.installed != versionData.latest
			this.utils.getCurrentAkashVersion().then(versionData=>{
				status.current = versionData.installed;
				status.latest = versionData.latest;
				status.isUpToDate = versionData.installed == versionData.latest;
				if(status.latest.trim() == ''){
					status.isUpToDate = true;
					status.latest = status.current;
					//in the event we cached a non-result for latest, we skip this 20 min interval
				}
				this.wallet.checkProviderUpStatus().then(d=>{
					status.active = true;
					socket.emit('versionStatus',status);
					
				}).catch(e=>{
					status.active = false;
					socket.emit('versionStatus',status);
				})
			})
		});

	}
	initSocketListener(room,serverName){
		if(typeof this.ioNamespaces[serverName].socketRoomInterval == "undefined"){
			//spin up an interval to send out stats
			this.ioNamespaces[serverName].socketRoomInterval = setInterval(()=>{
				this.sendSocketUpdates(serverName);
			},60000);
		}
		if(typeof this.ioNamespaces[serverName].marketQueryInterval == "undefined"){
			this.ioNamespaces[serverName].marketQueryInterval = setInterval(()=>{
				this.getMarketAggregates().then(data=>{
					this.ioNamespaces[serverName].namespace.to('akt').emit('marketAggregatesUpdate',data);
				}).catch(error=>{
					console.log('error fetching market aggregates',error);
				});
				
			},180000);
			
		}
		if(typeof this.ioNamespaces[serverName].updateCheckInterval == "undefined"){
			//spin up an interval to send out update stats every 20 mins
			this.ioNamespaces[serverName].updateCheckInterval = setInterval(()=>{
				this.checkForUpdates(serverName);
			},1000*60*20);
			this.checkForUpdates(serverName); //check right away
		}

	}
	checkForUpdates(serverName){
		this.handyUtils.checkForUpdates().then(data=>{
			//console.log('HandyHost versionData',data);
			if(!data.isUpToDate){
				this.ioNamespaces[serverName].namespace.to('akt').emit('HandyHostUpdatesAvailable',data);
			}
			else{
				this.ioNamespaces[serverName].namespace.to('akt').emit('HandyHostIsUpToDate',data);
			}
		}).catch(error=>{
			console.log('error checking for handyhost updates',error);
		})
		this.k8sUtils.checkForKubesprayUpdates().then(data=>{
			this.ioNamespaces[serverName].namespace.to('akt').emit('kubesprayVersionStatus',data);
		})
	}
	removeSocketListener(room,serverName){
		//everybody left the room, kill the update interval
		clearInterval(this.ioNamespaces[serverName].socketRoomInterval);
		delete this.ioNamespaces[serverName].socketRoomInterval;
		clearInterval(this.ioNamespaces[serverName].marketQueryInterval);
		delete this.ioNamespaces[serverName].marketQueryInterval;
		clearInterval(this.ioNamespaces[serverName].updateCheckInterval);
		delete this.ioNamespaces[serverName].updateCheckInterval;
	}
	sendSocketUpdates(serverName){
		this.getClusterStats().then(data=>{
			this.ioNamespaces[serverName].namespace.to('akt').emit('update',data);
		}).catch(error=>{
			console.log('error fetching realtime cluster stats',error);
		});
		/*
		this.ioNamespace.to('dvpn').emit('update',{
			chain:chainData,
			wallet:walletData,
			daemon: versionD
		});
		*/
	}
	api(path,requestBody,resolve,reject){
		switch(`${path[1]}`){
			
			case 'getState':
				//check if its installed
				this.wallet.getState().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				});
			break;
			case 'getHosts':
				this.getClusterConfig().then(configData=>{
					this.utils.getHosts(configData).then(data=>{
						resolve(data);
					}).catch(error=>{
						reject(error);
					})
				});
				
			break;
			case 'initWallet':
				this.initWallet(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				});
			break;
			case 'getWallets':
				this.getWallets(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				});
			break;
			case 'getClusterConfig':
				this.getClusterConfig().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				});
			break;
			case 'saveClusterConfig':
				this.saveClusterConfig(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				});
			break;
			case 'saveClusterConfigurator':
				this.saveClusterFromConfigurator(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				});
			break;
			case 'enableSSHForNode':
				this.enableSSHForNode(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				});
			break;
			case 'getDisks':
				this.getDisks(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				});
			break;
			case 'addDisk':
				this.addDisk(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				});
			break;
			case 'generateKubernetesInventory':
				this.generateKubernetesInventory(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				});
			break;
			case 'configuratorBuildKubernetes':
				this.configuratorBuildKubernetes(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'getUbuntuUSBDisks':
				this.diskUtils.getUbuntuUSBNVMe().then(usbs=>{
					resolve(usbs);
				}).catch(error=>{
					reject(error);
				});
			break;
			case 'getThumbDrives':
				//get thumb drives for iso creation
				const method = process.platform == 'darwin' ? this.diskUtils.getUSBFromDiskUtil : this.diskUtils.getThumbDrivesNEW;
				method().then(usbs=>{
					resolve({platform:process.platform,usbs});
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'flashThumbDrive':
				this.flashThumbDrive(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'configureNVMe':
				//path,hostname
				this.generateUbuntuCloudInit(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject({error});
				});
			break;
			case 'getClusterStats':
				this.getClusterStats().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				});
			break;
			case 'getK8sStats':
				this.k8sUtils.getClusterStats().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				});
			break;
			case 'getProviderDetail':
				this.k8sUtils.getProviderDetail().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				});
			break;
			case 'getGlobalIP':
				this.k8sUtils.getGlobalIP().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				});
			break;
			case 'updateProviderRegistration':
			case 'createProviderRegistration':
				let mode = path[1] == 'updateProviderRegistration' ? 'update' : 'create';
				this.registerProvider(requestBody,mode,false).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				});
			break;
			case 'providerRegistrationGasEstimate':
				this.registerProvider(requestBody,'create',true).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				});
			break;
			case 'generateServerCert':
				this.generateServerCert(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'getMarketplaceOrders':
				this.getMarketOrders(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				});
			break;
			case 'getMarketplaceOrder':
				this.getMarketOrder(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'getMarketplaceBids':
				this.getMarketBids(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'getMarketplaceLeases':
				this.getMarketLeases(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'runProvider':
				this.runProvider(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'createBid':
				this.createOrCancelBid(requestBody,'create').then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'cancelBid':
				this.createOrCancelBid(requestBody,'cancel').then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'fetchAllOrderBids':
				this.fetchAllOrderBids(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				});
			break;
			case 'getRandomHostname':
				this.getRandomHostname(path[2]).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'getRandomProviderName':
				this.getRandomProviderName().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'getMarketAggregates':
				this.getMarketAggregates().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
				
			break;
			case 'updateAkashToLatest':
				this.utils.updateAkashToLatest(this.ioNamespaces).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'getProviderLogs':
				this.getProviderLogs().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'haltProvider':
				this.wallet.haltProvider().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'updateKubespray':
				this.k8sUtils.updateKubespray(this.ioNamespaces).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'removeDanglingContainers':
				this.utils.removeDanglingContainers().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				});
			break;
		}
		
	}
	getProviderLogs(){
		return new Promise((resolve,reject)=>{
			let logs = 'No Logs Found...';
			const logsPath = process.env.HOME+'/.HandyHost/aktData/providerRun.log';
			if(fs.existsSync(logsPath)){
				logs = fs.readFileSync(logsPath,'utf8');
			}
			resolve(logs);
		});
	}
	getMarketAggregates(){
		const myWallet = this.getProviderWalletAddress();
		return this.market.getMarketAggregates(myWallet);
		
	}
	getRandomProviderName(){
		return new Promise((resolve,reject)=>{
			const moniker = generator({words: 3}).dashed;
			resolve({moniker});
		})
	}
	getRandomHostname(ipAddress){
		return new Promise((resolve,reject)=>{
			const moniker = 'akash-'+generator({words: 3}).dashed;
			this.k8sUtils.addUbuntuAutoinstalledNode(decodeURIComponent(ipAddress).trim(),moniker,this.ioNamespaces);
			resolve(moniker);
		})
	}
	flashThumbDrive(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		return this.k8sUtils.flashThumbDrive(parsed.path,parsed.pw,parsed.id,this.ioNamespaces);
	}
	fetchAllOrderBids(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		return this.market.fetchAllOrderBids(parsed.bid,parsed.params);
	}
	createOrCancelBid(requestBody,mode){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		const walletName = this.getProviderWalletName();
		if(mode == 'create'){
			return this.market.createBid(parsed,walletName);
		}
		if(mode == 'cancel'){
			return this.market.cancelBid(parsed,walletName);
		}
	}

	runProvider(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		return new Promise((resolve,reject)=>{
			this.wallet.checkProviderUpStatus().then(()=>{
				console.log('node is up');

				resolve({active:true});
				
			}).catch(err=>{
				//throws error when node isnt up
				this.getClusterStats().then(statsOut=>{
					console.log('shold run? ',statsOut.providerIsRegistered && statsOut.providerHasGeneratedCert);
					if(statsOut.providerIsRegistered && statsOut.providerHasGeneratedCert){
						//we should auto start this node then..
						const params = {
							serverHost: this.getProviderHost(),
							walletName: this.getProviderWalletName(),
							pw: parsed.pw,
							cpuPrice:parsed.cpu,
							fees:parsed.fees
						}
						this.wallet.setupProviderAutostart(params,parsed.autostart);
						this.wallet.startProvider(params).then(response=>{
							if(response.success){
								resolve({active:true});
							}
							else{
								resolve({active:false,message:response.error})
							}
						})
						//params = walletName,serverHost,prob password????
					}
					else{
						resolve({active:false,message:'Provider is not registered and/or has not generated a provider certificate. Visit Cluster Status Page to remedy.'})
					}
				});
			})
		})
		

			
	}
	getMarketBids(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		const myWallet = this.getProviderWalletAddress();
		//console.log('bid data',params,wallet);
		return this.market.getBids(parsed,myWallet);
	}
	getMarketLeases(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		const myWallet = this.getProviderWalletAddress();
		//console.log('lease data',params,wallet);
		return this.market.getLeases(parsed,myWallet);
	}
	getMarketOrders(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		return this.market.getOrders(parsed);
	}
	getMarketOrder(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		return this.market.getOrder(parsed);
	}
	generateServerCert(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		const providerHost = this.getProviderHost();
		const walletAddress = this.getProviderWalletAddress();
		return this.wallet.createOrUpdateServerCertificate(parsed,walletAddress,providerHost);
	}
	registerProvider(requestBody,mode,isGasEstimate){
		
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		if(isGasEstimate){
			mode = parsed.mode;
		}
		const providerHost = this.getProviderHost();

		/*if(parsed.generateCert && isGasEstimate){
			const walletAddress = this.getProviderWalletAddress();
			return this.wallet.createOrUpdateServerCertificate(parsed,walletAddress,providerHost,isGasEstimate);
		}
		else{*/
			return this.wallet.registerProvider(parsed,mode,providerHost,isGasEstimate);
		//}
	}
	getProviderWalletAddress(){
		const config = JSON.parse(fs.readFileSync(this.clusterConfigFilePath,'utf8'));
		if(typeof config.provider == "undefined"){
			return undefined;
		}
		return config.provider.providerWalletAddress;
	}
	getProviderHost(){
		const config = JSON.parse(fs.readFileSync(this.clusterConfigFilePath,'utf8'));
		return config.provider.providerIP;
	}
	getProviderWalletName(){
		const config = JSON.parse(fs.readFileSync(this.clusterConfigFilePath,'utf8'));
		return config.provider.providerWalletName;
	}
	getClusterStats(){
		return new Promise((resolve,reject)=>{
			const statsToFetch = 5;
			let statsFetched = 0;
			const statsOut = {};
			let providerIsRegistered = false; //TODO get fs.existsSync of something?
			let providerReceiptTX; 
			this.k8sUtils.getClusterStats().then(k8sStats=>{
				statsOut.k8s = k8sStats;
				statsFetched++;
				finish(statsFetched,statsToFetch,statsOut,resolve);
			}).catch(error=>{
				console.log('error fetching k8s stats',error);
			})
			this.utils.getCurrentAkashVersion().then(versionData=>{
				if(versionData.latest.trim() == ''){
					//ok skip because we cached null data
					versionData.latest = versionData.installed;
				}
				statsOut.akashVersion = versionData;
				statsFetched++;
				finish(statsFetched,statsToFetch,statsOut,resolve);
			})
			this.getClusterConfig().then(config=>{
				let numberNodes = 0;
				let providerData = {};
				if(typeof config.nodes != "undefined"){
					numberNodes = config.nodes.length;
				}
				if(typeof config.provider != "undefined"){
					providerData = config.provider;
				}
				
				//const providerData = config.provider;
				statsOut.nodeCount = numberNodes;
				statsOut.providerData = providerData;
				statsOut.providerIsRegistered = providerIsRegistered;
				statsOut.providerHasGeneratedCert = fs.existsSync(process.env.HOME+'/.akash/'+providerData.providerWalletAddress+'.pem');
				if(typeof providerData.providerWalletAddress != "undefined"){
					if(fs.existsSync(process.env.HOME+'/.HandyHost/aktData/providerReceipt.'+providerData.providerWalletAddress+'.json')){
						//const receipt = JSON.parse(fs.readFileSync(process.env.HOME+'/.HandyHost/aktData/providerReceipt.'+providerData.providerWalletAddress+'.json','utf8'))
						//https://www.mintscan.io/akash/txs/FB427B253030607DF2548F6C568F17D73E91A7E6CD962087F33360D68461A1F4
						/*const {tx,wallet} = this.wallet.getMetaFromTransaction(receipt);
						if(wallet == providerData.providerWalletAddress){
							statsOut.providerIsRegistered = true;
							statsOut.providerReceiptTX = tx;
						}*/
						statsOut.providerIsRegistered = true;
						statsOut.providerReceiptTX = "deprecated";
						
					};
				}
				statsFetched++;
				finish(statsFetched,statsToFetch,statsOut,resolve);
				if(typeof providerData.providerWalletAddress != "undefined"){
					this.wallet.getBalance(providerData.providerWalletAddress).then(balance=>{
						statsOut.balance = balance;
						statsFetched++;
						finish(statsFetched,statsToFetch,statsOut,resolve);
					});
				}
				else{
					statsOut.balance = {balance:{balances:[]}};
					statsFetched++;
					finish(statsFetched,statsToFetch,statsOut,resolve);
				}
				this.wallet.checkProviderUpStatus().then(d=>{
					statsOut.providerIsRunning = true;
					statsFetched++;
					finish(statsFetched,statsToFetch,statsOut,resolve);
				}).catch(e=>{
					statsOut.providerIsRunning = false;
					statsFetched++;
					finish(statsFetched,statsToFetch,statsOut,resolve);
				})
			})

		})
		function finish(statsFetched,statsToFetch,statsOut,resolve){
			if(statsFetched == statsToFetch){
				resolve(statsOut);
			}
		}
	}
	generateUbuntuCloudInit(requestBody){
		//getHosts(existingConfigData)
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		return new Promise((resolve,reject)=>{
			this.getClusterConfig().then(configData=>{
				this.utils.getHosts(configData).then(data=>{
					this.k8sUtils.generateUbuntuCloudInit(parsed,data).then(res=>{
						resolve(res);
					}).catch(error=>{
						reject(error);
					})
				}).catch(error=>{
					reject(error);
				})
			})
		})
	}
	configuratorBuildKubernetes(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		return new Promise((resolve,reject)=>{
			this.k8sUtils.createKubernetesInventory(this.clusterConfigFilePath,this.ioNamespaces).then((data)=>{
				resolve(data);
			}).catch(error=>{
				reject(error);
			})
		
		})
	}
	generateKubernetesInventory(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		return new Promise((resolve,reject)=>{
			this.utils.saveClusterConfig(parsed,this.clusterConfigFilePath).then(()=>{
				this.k8sUtils.createKubernetesInventory(this.clusterConfigFilePath,this.ioNamespaces).then((data)=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			})
		})
		
		
	}
	addDisk(requestBody){
		/*
		node:nodeData,
				disk
		*/
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		return new Promise((resolve,reject)=>{
			//mounted
			this.diskUtils.addDisk(parsed.node,parsed.disk).then(data=>{
				if(data.mounted){
					this.getClusterConfig().then(config=>{
						if(typeof config.nodes != "undefined"){
							config.nodes.map(node=>{
								if(node.mac == parsed.node.mac){
									//update node
									node.diskConfigured = true;
								}
							})
							this.utils.saveClusterConfig(config,this.clusterConfigFilePath).then((done)=>{
								resolve({success:true,config});
							})
						}
					})
				}
				else{
					reject(data);
				}
			})
		})
	}
	getDisks(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		return this.diskUtils.getDisks(parsed.node);
	}
	getClusterConfig(){
		return new Promise((resolve,reject)=>{
			const configFile = this.clusterConfigFilePath;
			if(fs.existsSync(configFile)){
				let json = JSON.parse(fs.readFileSync(configFile,'utf8'));
				if(typeof json.preConfiguredNVMe != "undefined" && typeof json.nodes != "undefined"){
					json.nodes.map(node=>{
						if(typeof json.preConfiguredNVMe[node.hostname.split('.')[0]] != "undefined"){
							node.sshConfigured = true;
							node.user = 'ansible';
						}
					});
				}
				resolve(json)
			}
			else{
				resolve({});
			}
		})
		
	}
	enableSSHForNode(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		console.log('enable ssh for node',parsed);
		return this.utils.enableSSHForNode(parsed.node,parsed.user,parsed.pw,this.clusterConfigFilePath);
		
	}
	saveClusterConfig(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		return this.utils.saveClusterConfig(parsed,this.clusterConfigFilePath,this.ioNamespaces);
		
	}
	saveClusterFromConfigurator(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		return this.utils.saveClusterFromConfigurator(parsed,this.clusterConfigFilePath,this.ioNamespaces);
	}
	getWallets(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		return this.wallet.getKeyList(parsed.pw);
	}
	initWallet(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		if(parsed.import){
			//init from seed
			return this.wallet.initWalletFromSeed(parsed.seed, parsed.pw, parsed.walletName);
		}
		else{
			return this.wallet.initWallet(parsed.pw, parsed.walletName);
		}
	}
	parseRequestBody(requestBody){
		let parsed;
		let err;
		try{
			parsed = JSON.parse(requestBody);
		}
		catch(e){
			err = e;
		}
		return {parsed,err};
	}
}