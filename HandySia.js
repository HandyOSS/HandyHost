import {Wallet} from './siaAPI/Wallet.js';
import {Consensus} from './siaAPI/Consensus.js';
import {Host} from './siaAPI/Host.js';
import {Daemon} from './siaAPI/Daemon.js';
import {CommonUtils} from './CommonUtils.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import url from 'url';
import {spawn} from 'child_process';
import QRCode from 'qrcode';

export class HandySia{
	constructor(){
		this.ioNamespaces = {};
		this.siaPortsPath = process.env.HOME+'/.HandyHost/siaData/siaPorts.json';
		this.redlistPortsPath = process.env.HOME+'/.HandyHost/ports.json';
		this.wallet = new Wallet();
		this.consensus = new Consensus();
		this.host = new Host();
		this.daemon = new Daemon();
		this.handyUtils = new CommonUtils();
		try{
			fs.mkdirSync(`${process.env.HOME}/.HandyHost/siaData`,{recursive:true})
		}
		catch(e){
			//folder already exists
		}
		
		this.trySpawningSiad();
		//this.consensus.getChainStatus();
	}
	initHealthCheck(){
		console.log('init SC health check interval')
		if(typeof this.healthCheckInterval != "undefined"){
			clearInterval(this.healthCheckInterval);
			delete this.healthCheckInterval;
		}
		this.healthCheckInterval = setInterval(()=>{
			//every 20 mins
			checkHealth();
		},1000*60*20)
		const _this = this;
		function checkHealth(){
			console.log('performing SC health check')
			_this.daemon.getVersion().then(data=>{
				console.log('SC is alive')
			}).catch(err=>{
				console.log('SC health check error: siad must be down');
				const didJustUpdateFileLoc = process.env.HOME+'/.HandyHost/siaData/isUpdating';
				const didJustUpdate = fs.existsSync(didJustUpdateFileLoc);
				if(didJustUpdate){
					console.log('SC health check: looks like an update happened, hold off')
				}
				else{
					console.log('starting healthcheck revival');
					const logString = new Date()+' :: healthcheck is beginning';
					fs.appendFileSync(process.env.HOME+'/.HandyHost/siaData/healthcheck.log',logString,'utf8');
					//first make sure theres not a zombie siad
					const pkill = spawn('pkill',['-f','siad']);
					pkill.stdout.on('data',d=>{
						console.log('pkill out',d.toString());
					});
					pkill.stderr.on('data',d=>{
						console.log('pkill err',d.toString());
					})
					pkill.on('close',()=>{
						setTimeout(()=>{
							const logString = new Date()+' :: healthcheck is restarting siad';
							fs.appendFileSync(process.env.HOME+'/.HandyHost/siaData/healthcheck.log',logString,'utf8');
							_this.trySpawningSiad(true);
						},90000)
					})
					//this.trySpawningSiad();
				}
				
			})
		}
	}
	trySpawningSiad(wasFromHealthcheck){
		const didJustUpdateFileLoc = process.env.HOME+'/.HandyHost/siaData/isUpdating';
		const didJustUpdate = fs.existsSync(didJustUpdateFileLoc);
		if(!fs.existsSync(this.siaPortsPath)){
			//console.log('sia ports are not present yet, hold...')
			return false;
		}
		this.daemon.getVersion().then(data=>{
			console.log('fetched version',data);
			this.consensus.getChainStatus().then(d=>{
				//console.log('chain stats',d);
				if(typeof process.env.SCAUTO != "undefined"){
					const encrypted = process.env.HOME+'/.HandyHost/keystore/'+process.env.SCAUTO;
					if(fs.existsSync(encrypted)){
						this.handyUtils.decrypt(encrypted,true).then(pass=>{
							//unlock on startup so that we can host files else lose $$$
							const passHash = crypto
								.createHash("sha256")
								.update(pass)
								.digest("hex");
							this.siaPasswordHash = passHash;
							
							this.wallet.unlockWallet(pass).then(data=>{
								console.log('wallet unlock success',data);
								
								if(didJustUpdate){
									fs.unlinkSync(didJustUpdateFileLoc);
									Object.keys(this.ioNamespaces).map(serverName=>{
										this.ioNamespaces[serverName].namespace.to('sia').emit('postUpdateSpawnFinished');
									})
								}
								if(fs.existsSync(encrypted)){
									fs.unlinkSync(encrypted);
									this.handyUtils.encrypt(pass,true,'healthcheckSC').then(outpath=>{
										process.env.SCAUTO = outpath;
									});
								}
								if(wasFromHealthcheck){
									const logString = new Date()+' :: healthcheck restarted siad';
									fs.appendFileSync(process.env.HOME+'/.HandyHost/siaData/healthcheck.log',logString,'utf8');
								}
								this.initHealthCheck();
							}).catch(error=>{
								console.log('error unlocking wallet',error);
							});
						})
					}
					
				}
				else{
					console.log('no sia autostart params found');
				}
				if(process.platform == 'darwin'){
					//macos uses keychain

					this.handyUtils.getDarwinKeychainPW('HANDYHOST_SCAUTO').then(data=>{
						if(data.exists){
							const passHash = crypto
								.createHash("sha256")
								.update(data.value)
								.digest("hex");
							this.siaPasswordHash = passHash;
							
							this.wallet.unlockWallet(data.value).then(data=>{
								console.log('wallet unlock success',data);
								if(didJustUpdate){
									fs.unlinkSync(didJustUpdateFileLoc);
									Object.keys(this.ioNamespaces).map(serverName=>{
										this.ioNamespaces[serverName].namespace.to('sia').emit('postUpdateSpawnFinished');
									})
								}
								if(wasFromHealthcheck){
									const logString = new Date()+' :: healthcheck restarted siad';
									fs.appendFileSync(process.env.HOME+'/.HandyHost/siaData/healthcheck.log',logString,'utf8');
								}
								this.initHealthCheck();
								
							}).catch(error=>{
								console.log('error unlocking wallet',error);
							});
						}
					})
				}
			}).catch(e=>{
				console.error('ERROR FETCHING CHAIN STATUS',e);
				console.log('e?',e);
			});
		}).catch(e=>{
			console.log('no version, must be dead')
			this.daemon.siadSpawn().then(()=>{
				this.attemptWalletUnlock(wasFromHealthcheck);
				
				
			}).catch(e=>{
				console.log('error spawning siad')
			})
		});
	}
	attemptWalletUnlock(wasFromHealthcheck){
		setTimeout(()=>{
			const didJustUpdateFileLoc = process.env.HOME+'/.HandyHost/siaData/isUpdating';
			const didJustUpdate = fs.existsSync(didJustUpdateFileLoc);
			
			//give a little time to boot it up..
			if(typeof process.env.SCAUTO != "undefined"){
				
				const encrypted = process.env.HOME+'/.HandyHost/keystore/'+process.env.SCAUTO;
				if(fs.existsSync(encrypted)){
					this.handyUtils.decrypt(encrypted,true).then(pass=>{
						//unlock on startup so that we can host files else lose $$$
						const passHash = crypto
							.createHash("sha256")
							.update(pass)
							.digest("hex");
						this.siaPasswordHash = passHash;
						console.log('tryingwallet unlock')
						this.wallet.unlockWallet(pass).then(data=>{
							console.log('wallet unlock success');
							if(fs.existsSync(encrypted)){
								fs.unlinkSync(encrypted);
								this.handyUtils.encrypt(pass,true,'healthcheckSC').then(outpath=>{
									process.env.SCAUTO = outpath;
								});
							}
							if(didJustUpdate){
								fs.unlinkSync(didJustUpdateFileLoc);
								Object.keys(this.ioNamespaces).map(serverName=>{
									this.ioNamespaces[serverName].namespace.to('sia').emit('postUpdateSpawnFinished');
								})
							}
							if(wasFromHealthcheck){
								const logString = new Date()+' :: healthcheck restarted siad';
								fs.appendFileSync(process.env.HOME+'/.HandyHost/siaData/healthcheck.log',logString,'utf8');
							}
							this.initHealthCheck();
						}).catch(error=>{
							console.log('error unlocking wallet',error);
							if(error.toString() == '490'){
								this.attemptWalletUnlock(wasFromHealthcheck);
							}
						});
					})
				}
				else{
					console.log('no encrypted sia credentials found')
				}
			}
			else{
				if(process.platform == 'darwin'){
					//macos uses keychain

					this.handyUtils.getDarwinKeychainPW('HANDYHOST_SCAUTO').then(data=>{
						if(data.exists){
							const passHash = crypto
								.createHash("sha256")
								.update(data.value)
								.digest("hex");
							this.siaPasswordHash = passHash;
							
							console.log('tryingwallet unlock')
							this.wallet.unlockWallet(data.value).then(data=>{
								console.log('wallet unlock success');
								if(wasFromHealthcheck){
									const logString = new Date()+' :: healthcheck restarted siad';
									fs.appendFileSync(process.env.HOME+'/.HandyHost/siaData/healthcheck.log',logString,'utf8');
								}
								this.initHealthCheck();
							}).catch(error=>{
								console.log('error unlocking wallet',error);
								if(error.toString() == '490'){
									this.attemptWalletUnlock(wasFromHealthcheck);
								}
							});
						}
						else{
							console.log('no encrypted sia credentials found')
						}
					})
				}
				else{
					console.log('no encrypted sia credentials found')
				}
				
			}
			/*if(typeof process.env.SIA_WALLET_PASSWORD != "undefined"){
				//unlock on startup so that we can host files else lose $$$
				console.log('tryingwallet unlock')
				this.wallet.unlockWallet(process.env.SIA_WALLET_PASSWORD).then(data=>{
					console.log('wallet unlock success');
				}).catch(error=>{
					console.log('error unlocking wallet',error);
					if(error.toString() == '490'){
						this.attemptWalletUnlock();
					}
				});
				
			}*/
		},5000);
	}
	api(path,requestBody,resolve,reject){
		switch(`${path[1]}`){
			case 'getHostConfig':
				this.host.getHostInfo().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				});
			break;
			case 'updateHostConfig':
				console.log('got config data',requestBody)
				//todo set config data
				this.updateHostConfig(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'getDirList':
				this.getDirList(path.slice(2,path.length)).then(list=>{
					resolve(list);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'addNewDirectory':
				this.addNewDirectory(path.slice(2,path.length)).then(list=>{
					resolve(list);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'getDirCapacity':
				this.getDirCapacity(path.slice(2,path.length)).then(meta=>{
					resolve(meta);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'getWalletInfo':
				this.wallet.getWalletInfo().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'initWallet':
				this.initWallet(requestBody).then(data=>{
					setTimeout(()=>{
						this.updateEnvironment(requestBody).then(()=>{
							resolve(data);
						});
					},1500); //give it time to make the wallet
					
				}).catch(error=>{
					
					reject(error);
				})
			break;
			case 'getWalletAddress':
				this.getLatestAddress().then(data=>{
					resolve(data);
				}).catch(err=>{
					reject(err);
				});
			break;
			case 'getNewWalletAddress':
				this.wallet.getWalletAddress().then(data=>{
					resolve(data);
				}).catch(error=>{
					console.log('err',error);
					reject(error);
				})
			break;
			case 'getChainStatus':
				this.consensus.getChainStatus().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'getQRCode':
				this.getQRCode(path[2]).then(data=>{
					resolve({qr:data});
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'getRecentTransactions':
				this.wallet.getRecentTransactions().then(data=>{
					if(data.confirmedtransactions != null){
						data.confirmedtransactions = data.confirmedtransactions.reverse().slice(0,20);
					}
					resolve(data);
				}).catch(e=>{
					reject(e);
				})
			break;
			case 'sendSC':
				this.sendSC(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'getStorage':
				//returns folders
				this.host.getStorage().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'updateFolders':
				this.updateFolders(requestBody).then(data=>{
					this.host.getStorage().then(d=>{
						console.log('got storage then',d);
						resolve(d);
					}).catch(e=>{
						reject(e);
					});
				
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'getContracts':
				this.host.getContracts().then(data=>{
					resolve(data);
				}).catch(e=>{
					reject(e);
				});
			break;
			case 'getContractByID':
				this.host.getContract(path[2]).then(data=>{
					resolve(data);
				}).catch(e=>{
					reject(e);
				})
			break;
			case 'getScoreEstimate':
				this.host.estimateScore().then(data=>{
					resolve(data);
				}).catch(e=>{
					reject(e);
				});
			break;
			case 'getHostPublicKey':
				this.getHostPublicKey().then(data=>{
					resolve(data);
				}).catch(e=>{
					reject(e);
				});
			break;
			case 'getHostMetrics':
				this.getHostMetrics().then(data=>{
					resolve(data);
				}).catch(e=>{
					reject(e);
				})
			break;
			case 'getPorts':
				this.getSiaPorts().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'setPorts':
				this.setSiaPorts(requestBody).then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'updateSia':
				this.updateSia().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
			case 'getUpdatingStatus':
				this.getUpdatingStatus().then(data=>{
					resolve(data);
				}).catch(error=>{
					reject(error);
				})
			break;
		}
	}
	getUpdatingStatus(){
		return new Promise((resolve,reject)=>{
			const didJustUpdateFileLoc = process.env.HOME+'/.HandyHost/siaData/isUpdating';
			const didJustUpdate = fs.existsSync(didJustUpdateFileLoc);
			resolve({updating:didJustUpdate});
		});
	}
	updateSia(){
		return new Promise((resolve,reject)=>{
			const _this = this;
			console.log('starting update',new Date())
			this.daemon.updateDaemon().then(done=>{
				done("");
			}).catch(e=>{
				console.log("update done?",e);
				if(e == ""){
					done(e);
				}
				else{
					reject({error:e});
				}
				//reject(e);
			})

			function done(e){
				console.log('update is done',new Date());
				fs.writeFileSync(process.env.HOME+'/.HandyHost/siaData/isUpdating',"true",'utf8');
				resolve({message:"Update Finished. Restarting Sia (may take anywhere from ~30-45 seconds up to 20 minutes)..."})
				if(process.platform == 'darwin'){
					//restart things
					//trySpawningSiad()
					_this.daemon.haltSiad().then(d=>{
						console.log('halted siad, restarting now');
						_this.trySpawningSiad();
						
					});
				}
				else{
					//systemctl restart
					_this.daemon.haltSiad().then(d=>{
						console.log('halted siad');
						if(typeof process.env.HANDYHOST_BOOTSTRAPPED != "undefined"){
							console.log('restart handyhost bootstrap dev')
							spawn('sudo',['bash','./localdev_bootstrap.sh','restart'],{env:process.env,pwd:process.env.PWD});
						}
						else{
							console.log('systemctl restart');
							spawn('sudo',['systemctl','restart','handyhost'])	
						}
							
					});
					
				}
			}
		})
		
	}
	getSiaPorts(){
		return new Promise((resolve,reject)=>{
			let ports = {};
			const portsFilePath = this.siaPortsPath;
			
			let redlist = {};
			if(fs.existsSync(this.redlistPortsPath)){
				redlist = JSON.parse(fs.readFileSync(this.redlistPortsPath,'utf8'));
			}
			if(fs.existsSync(portsFilePath)){
				ports = JSON.parse(fs.readFileSync(portsFilePath));
				ports.redlist = redlist;
				resolve(ports);
			}
			else{
				//if no ports defined yet we give some info about port forwarding with the local IP
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
					ports.ip = ipRangeOut;
					ports.redlist = redlist;
					resolve(ports);
				});
			}
			
		})
		

	}
	setSiaPorts(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		return new Promise((resolve,reject)=>{
			const portsFilePath = this.siaPortsPath;
			parsed.portsSet = true;
			let redlist = {};
			let didChange = false;
			if(fs.existsSync(portsFilePath)){
				const existingPorts = JSON.parse(fs.readFileSync(portsFilePath));
				Object.keys(existingPorts).map(label=>{
					if(typeof parsed[label] == "undefined"){
						didChange = true;
					}
					else{
						if(parsed[label] != existingPorts[label]){
							didChange = true;
						}
					}
				})
			}
			
			if(fs.existsSync(this.redlistPortsPath)){
				redlist = JSON.parse(fs.readFileSync(this.redlistPortsPath,'utf8'));
				Object.keys(parsed).map(type=>{
					if(type != "portsSet"){
						Object.keys(redlist.custom).map(port=>{
							const d = redlist.custom[port];
							if(d.key == type){
								delete redlist.custom[port];
							}
						});
						redlist.custom[parsed[type]] = {
							"description": "Sia Custom "+type+" Port",
							"service":"SC",
							"key":type
						}
					}
				});
				fs.writeFileSync(this.redlistPortsPath,JSON.stringify(redlist,null,2),'utf8');
			}
			fs.writeFileSync(portsFilePath,JSON.stringify(parsed),'utf8');
			console.log('trying siad restart');
			if(didChange){
				setTimeout(()=>{
					//give the host time to announce the new ports before we restart siad
					this.consensus.getChainStatus().then(chainD=>{
						console.log('about to halt siad');
						this.daemon.haltSiad().then(d=>{
							console.log('halted siad, restarting now');
							this.trySpawningSiad(); //todo restart siad if it's already running???
							resolve(parsed);
						});
					}).catch(error=>{
						//not running
						console.log('siad was not running, starting siad')
						this.trySpawningSiad(); //todo restart siad if it's already running???
						resolve(parsed);
						
					});
				},2000)
				
			}
			else{
				console.log('no ports were changed, try to spawn siad just in case..')
				this.trySpawningSiad(); //todo restart siad if it's already running???
				resolve(parsed);
			}
			
			
		}).catch(error=>{
			console.log('caught err',error);
			reject(error);
		})
		
		//write to file
	}
	getHostMetrics(){
		return new Promise((resolve,reject)=>{
			//getHostInfo
			this.host.getHostInfo().then(data=>{
				let out = {
					registryentriestotal:0,
					registryentriesleft:0,
					financialmetrics:{},
					storagemetrics:{}
				}
				if(typeof data.pricetable != "undefined"){
					out.registryentriesleft = data.pricetable.registryentriesleft;
					out.registryentriestotal = data.pricetable.registryentriestotal;
				}
				if(typeof data.financialmetrics != "undefined"){
					out.financialmetrics = data.financialmetrics;
				}
				this.host.getStorage().then(storageData=>{
					out.storagemetrics = storageData;
					resolve(out);
				})
				//resolve(out);
			}).catch(e=>{
				console.log('sia: getHostMetrics err',e);
			})
		})
	}
	getHostPublicKey(){
		return new Promise((resolve,reject)=>{
			this.host.getHostInfo().then(d=>{
				let pk = d.publickey.key;
				resolve(new Buffer.from(pk,'base64').toString('hex'));
			}).catch(e=>{
				reject(e);
			})
		})
		
	}
	updateHostConfig(requestBody){

		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		console.log('update config',parsed);
		return new Promise((resolve,reject)=>{
			this.host.updateHostParameters(parsed).then(data=>{
				if(parsed.acceptingcontracts){
					//announce the host then
					this.host.announceHost(parsed.netaddress).then(res=>{
						console.log('announced',res);
						resolve(data);
					}).catch(e=>{
						reject(e);
					})
				}
				else{
					resolve(data);
				}
			}).catch(e=>{
				reject(e);
			})
		})
		
	}
	getFolderTypeCounts(folders){
		let newCount = 0;
		let editingCount = 0;
		let deletingCount = 0;
		folders.map(folder=>{
			const isNew = folder.isNew;
			const isEdited = folder.isEdited;
			const isDeleting = folder.isDeleting;
			if(isEdited && !isNew){
				editingCount++;
			}
			if(isEdited && isNew){
				newCount++;
			}
			if(isDeleting){
				deletingCount++;
			}


		});
		return {
			changeCount:(editingCount+newCount+deletingCount)
		};
	}
	updateFolders(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		console.log('to update folders',parsed,err);
		return new Promise((resolve,reject)=>{
			let finishedCount = 0;
			
			const {changeCount} = this.getFolderTypeCounts(parsed);
			console.log('changecount',changeCount);
			parsed.map(folder=>{
				const path = folder.path;
				const capacity = folder.capacity;
				const isNew = folder.isNew;
				const isEdited = folder.isEdited;
				const isDeleting = folder.isDeleting;
				if(isEdited && !isNew){
					//is not new but edited
					this.host.resizeStorageFolder(path,capacity).then(data=>{
						finishedCount += 1;
						if(finishedCount == changeCount){
							resolve();
						}
					}).catch(e=>{
						finishedCount += 1;
						if(finishedCount == changeCount){
							resolve();
						}
					});
				}
				if(isEdited && isNew){
					//is new
					this.host.addStorageFolder(path,capacity).then(data=>{
						finishedCount += 1;
						if(finishedCount == changeCount){
							resolve();
						}
					}).catch(e=>{
						finishedCount += 1;
						if(finishedCount == changeCount){
							resolve();
						}
					});
				}
				if(isDeleting){
					//should be deleted
					this.host.removeStorageFolder(path,true).then(data=>{
						finishedCount += 1;
							if(finishedCount == changeCount){
								resolve();
							}
						}).catch(e=>{
							finishedCount += 1;
							if(finishedCount == changeCount){
								resolve();
							}
					})
				}
			})
		});

	}
	sendSC(requestBody){
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		const destination = parsed.destination;
		const amountHastings = parsed.amount;
		const pw = parsed.pw;
		console.log('amt',amountHastings);
		console.log('dest',destination);
		const passHash = crypto
			.createHash("sha256")
			.update(pw)
			.digest("hex");
		if(passHash != this.siaPasswordHash){
			return new Promise((resolve,reject)=>{
				reject({message:"Incorrect Encryption Password"})
			})
		}
		/*if(pw != process.env.SIA_WALLET_PASSWORD){
			return new Promise((resolve,reject)=>{
				reject({message:"Incorrect Encryption Password"})
			});
		}*/
		return this.wallet.sendCoins(amountHastings,destination);
	}
	getQRCode(address){

		if(address == "undefined"){
			return new Promise((resolve,reject)=>{
				//get new address
				this.wallet.getLatestAddress().then(data=>{
					QRCode.toDataURL(data.address).then(qrResp=>{
						resolve(qrResp);
					}).catch(e=>{
						reject(e);
					})
					
				}).catch(error=>{
					console.log('err',error);
					reject(error);
				})
			})
			
		}
		else{
			return QRCode.toDataURL(address);
		}
		
	}
	getLatestAddress(){
		return new Promise((resolve,reject)=>{
			this.wallet.getLatestWalletAddress().then(data=>{
				if(typeof data.addresses == "undefined"){
					this.wallet.getWalletAddress().then(newdata=>{
						resolve(newdata);
					}).catch(error=>{
						console.log('err',error);
						reject(error);
					})
				}
				else{
					resolve({address:data.addresses[data.addresses.length-1]});
				}
				
			}).catch(error=>{
				console.log('err',error);
				reject(error);
			})
		})
		this.wallet.getLatestWalletAddress().then(data=>{
			if(typeof data.addresses == "undefined"){
				
			}
			resolve(data);
		}).catch(error=>{
			console.log('err',error);
			reject(error);
		})
	}
	checkWalletStatus(){
		//check if a wallet is syncing
		return new Promise((resolve,reject)=>{
			this.consensus.getChainStatus().then(chainData=>{
				const chainHeight = chainData.height;
				const isChainSynced = chainData.synced;
				this.wallet.getWalletInfo().then(walletData=>{
					const walletHeight = walletData.height;
					if(walletHeight == 0 && !walletData.encrypted){
						resolve(true);
					}
					resolve(walletHeight == chainHeight && isChainSynced);
				});
			})
		})
		
	}
	initWallet(requestBody){
		/*
		first check if wallet is syncing. 
		I noticed that if I try to force create a new wallet during 
		a wallet sync it crashes siad.
		*/
		const _this = this;
		const {parsed,err} = this.parseRequestBody(requestBody);
		if(typeof parsed == "undefined"){
			return new Promise((resolve,reject)=>{
				reject(err);
			})
		}
		if(parsed.import){
			//init from seed
			return this.wallet.initWalletFromSeed(parsed.seed, parsed.pw);
		}
		else{
			return this.wallet.initWallet(parsed.pw);
		}

		
		
		
	}
	manualWalletRemove(){
		return new Promise((resolve,reject)=>{
			this.daemon.stop().then(()=>{
				let hasError = false;
				try{
					fs.rmSync(`${process.env.HOME}/.HandyHost/siaData/wallet`,{recursive:true,force:true});
				}
				catch(e){
					console.log('error removing wallet');
					hasError = true;
					reject(e);
					
				}
				this.daemon.siadSpawn().then(()=>{
					let checkupInterval = setInterval(()=>{
						//give a little time to boot it up..

						this.consensus.getChainStatus().then(d=>{
							//console.log('chain stats',d);
							console.log('chain stats up');
							clearInterval(checkupInterval);
							resolve();
						}).catch(e=>{
							console.error('ERROR FETCHING CHAIN STATUS',e);
							console.log('e?',e);
						});

						
					},2000);
				
				
				}).catch(e=>{
					reject(e);
					console.log('error spawning siad')
				})


			}).catch(error=>{
				reject(error);
				console.log('error stopping siad',error)
			})
		});
	}
	updateEnvironment(requestBody){
		//it is recommended for sia hosting to always have the wallet unlocked so that
		//our host is always serving. no unlocked wallet = no serving = potential loss of revenue
		//due to power losses/unexpected restarts/etc.
		//so we set the wallet unlock pw as an encrypted file that root gives to us on start/restart of the app
		return new Promise((resolve,reject)=>{
			const {parsed,err} = this.parseRequestBody(requestBody);
			/*if(typeof parsed.pw != "undefined"){
				fs.writeFileSync(`${process.env.HOME}/.HandyHost/siaData/.walletEnv`,parsed.pw);
				process.env.SIA_WALLET_PASSWORD = parsed.pw;
			}*/
			//console.log('unlocking wallet',parsed.pw);
			this.wallet.unlockWallet(parsed.pw).then(()=>{
				if(process.platform == 'darwin'){
					//well just use keychain on mac
					//no daemons on mac bc user is always logged in
					this.handyUtils.setDarwinKeychainPW(parsed.pw,'HANDYHOST_SCAUTO');
				}
				else{
					this.handyUtils.encrypt(parsed.pw,true,'sc');
				}
				
				//set encrypted (with root's pubkey) unlock pass for root to pickup
				console.log('did unlock');
				resolve();
			});
		})
		
	}
	getDirCapacity(dirPath){
		//get folder capacity from df
		return new Promise((resolve,reject)=>{
			const unsafe = url.parse(decodeURIComponent(dirPath[0])).pathname;
			//console.log('unsafe',unsafe);
			const safe = path.normalize(unsafe).replace(/^(\.\.(\/|\\|$))+/, '');
			//console.log('safe',safe);
  			const p = spawn('df',[safe]);
  			let d = '';
  			p.stdout.on('data',(data)=>{
  				d += data.toString();
  			})
  			p.on('close',()=>{
  				//console.log('spawn ended');
  				let vals = d.split('\n');
  				let line = [];
  				let keys = ['filesystem','KBlocks','used','avail','use%','mounted on'];
  				let output = {}
  				if(typeof vals[1] != "undefined"){
  					line = vals[1].split(' ').filter(d=>{return d != '';});
  					line.map((val,i)=>{
  						output[keys[i]] = val;
  					})
  				}
  				resolve(output);
  			});
		});
	}
	addNewDirectory(path){
		return new Promise((resolve,reject)=>{
			let dir = decodeURIComponent(path);

			console.log('add new dir',dir);	
			
			fs.mkdirSync(dir,{recursive:true});

			let output = fs.readdirSync(dir,{withFileTypes:true}).filter(d=>{
				return d.isDirectory();
			}).filter(d=>{
				return d.name.indexOf('.') != 0;
			}).map(d=>{return d.name;});
			console.log('output',output);
			resolve({base:dir,paths:output});
		})
	}
	getDirList(path){
		return new Promise((resolve,reject)=>{
			let dir;
			if(path.length == 0){
				//new listing
				dir = '/';//process.env.HOME;
			}
			else{
				dir = decodeURIComponent(path);
			}
			
			let output = fs.readdirSync(dir,{withFileTypes:true}).filter(d=>{
				return d.isDirectory();
			}).filter(d=>{
				return d.name.indexOf('.') != 0;
			}).map(d=>{return d.name;});
			resolve({base:dir,paths:output});
		})
		
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
	addSocketNamespace(ioNamespace,serverName){
		

		//console.log('init sia sockets');
		this.ioNamespaces[serverName] = {namespace:ioNamespace};
		this.ioNamespaces[serverName].namespace.adapter.on("create-room", (room) => {
		  if(room.indexOf('sia') == 0){
		  	//start a Socket listener for this room
		  	this.initSocketListener(room,serverName);
		  }
		});

		this.ioNamespaces[serverName].namespace.adapter.on("delete-room", (room) => {
		  //console.log(`room deleted ${room}`);
		  if(room.indexOf('sia') == 0){
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
			this.addSocketConnection(socket,serverName);
		});
	}
	addSocketConnection(socket,serverName){
		socket.emit('register');
		socket.on('subscribe',()=>{
			socket.join('sia');
		})
		socket.on('forceRealtimeUpdate',()=>{
			this.sendSocketUpdates(serverName);
		})
		socket.on('getAppStatus',()=>{
			let status = {}
			this.daemon.getVersion().then(versionD=>{
				this.daemon.getUpdateAvailStatus().then(updateAvailable=>{
					status.latest = updateAvailable.version;
					status.current = versionD;
					if(typeof versionD == "object"){
						status.current = versionD.version;
					}
					status.isUpToDate = status.latest == status.current;
					status.active = true;
					socket.emit('versionStatus',status);
				});
			}).catch(error=>{
				const manualVersion = spawn('siad',['version']);
				let manualOut = '';
				manualVersion.stdout.on('data',(d)=>{
					manualOut += d.toString();
				})
				manualVersion.on('close',()=>{
					let manualV = manualOut.split(' ');
					manualV = manualV[manualV.length-1];
					status.active = false;
					status.current = manualV;
					socket.emit('versionStatus',status);
				})
				
			})
		})

	}
	initSocketListener(room,serverName){

		if(typeof this.ioNamespaces[serverName].socketRoomInterval == "undefined"){
			//spin up an interval to send out stats
			this.ioNamespaces[serverName].socketRoomInterval = setInterval(()=>{
				this.sendSocketUpdates(serverName);
				this.checkForUpdates(serverName);
			},60000);
			this.checkForUpdates(serverName); //check right away
		}
	}
	checkForUpdates(serverName){
		this.handyUtils.checkForUpdates().then(data=>{
			//console.log('HandyHost versionData',data);
			if(!data.isUpToDate){
				this.ioNamespaces[serverName].namespace.to('sia').emit('HandyHostUpdatesAvailable',data);
			}
			else{
				this.ioNamespaces[serverName].namespace.to('sia').emit('HandyHostIsUpToDate',data);
			}
		}).catch(error=>{
			console.log('error checking for handyhost updates',error);
		})
	}
	removeSocketListener(room,serverName){
		//everybody left the room, kill the update interval
		clearInterval(this.ioNamespaces[serverName].socketRoomInterval);
		delete this.ioNamespaces[serverName].socketRoomInterval;
	}
	sendSocketUpdates(serverName){
		let walletData,chainData;
		this.wallet.getWalletInfo().then(data=>{
			walletData = data;
			this.consensus.getChainStatus().then(chainD=>{
				chainData = chainD;
				this.daemon.getVersion().then(versionD=>{
					this.daemon.getUpdateAvailStatus().then(updateAvailable=>{
						this.host.getHostInfo().then(hostConfig=>{
							let cherries = {};
							cherries.connectabilitystatus = hostConfig.connectabilitystatus;
							cherries.workingstatus = hostConfig.workingstatus;
							cherries.collateralbudget = hostConfig.internalsettings.collateralbudget;
							cherries.lockedcollateral = hostConfig.financialmetrics.lockedstoragecollateral;
							cherries.acceptingcontracts = hostConfig.internalsettings.acceptingcontracts;
							//verify updates havent already been installed
							if(updateAvailable.available){
								if(updateAvailable.version == versionD){
									//ok we already updated
									//siac doesnt report it correctly after an update has been run..
									updateAvailable.available = false;
								}
							}
							this.ioNamespaces[serverName].namespace.to('sia').emit('update',{
								chain:chainData,
								wallet:walletData,
								daemon: versionD,
								updates:updateAvailable,
								config:cherries
							});
						})

					});
				});
			});
		}).catch(error=>{
			console.log('error with sockets')
		})
		
	}

}