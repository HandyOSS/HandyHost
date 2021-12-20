import {spawn} from 'child_process';
import fs from 'fs';
import https from 'https';
import generator from 'project-name-generator';
import {AKTUtils} from './Utils.js';
import QRCode from 'qrcode';
import {CommonUtils} from '../CommonUtils.js';
import {EnvUtils} from './envUtils.js';

export class Wallet{
	constructor(){
		this.utils = new AKTUtils();
		this.commonUtils = new CommonUtils();
		this.AKASH_NETWORK = 'mainnet';
		this.providerPaused = false;
		this.envUtils = new EnvUtils(true); //adhoc reset our rpc node on fall overs...
	}
	getState(){
		return new Promise((resolve,reject)=>{
			let exists = false;
			try{
				exists = fs.existsSync(`${process.env.HOME}/.akash/keyring-file`);
			}
			catch(e){
				exists = false;
			}
			const isAutostart = fs.existsSync(process.env.HOME+'/.HandyHost/aktData/autostart.json')
			console.log('akash exists??',exists);
			console.log("akash dir exists?",fs.existsSync(`${process.env.HOME}/.akash`));
			if(!exists){
				if(!fs.existsSync(`${process.env.HOME}/.akash`)){
					//akash needs inited
					this.initAkash().then(()=>{
						resolve({exists,initialized:true,isAutostart})
					}).catch(error=>{
						resolve({exists,initialized:false,isAutostart})
					})
				}
				else{
					resolve({exists,initialized:true,isAutostart})
				}
			}
			else{
				resolve({exists,initialized:true,isAutostart});
			}
		});
	}
	initAkash(){
		console.log('init akash');
		return new Promise((resolve,reject)=>{
			const options = {
				host: 'raw.githubusercontent.com',
				port:'443',
				path: `/ovrclk/net/master/${this.AKASH_NETWORK}/chain-id.txt`,
				method:'GET',
				rejectUnauthorized: true,
				requestCert: true,
				agent: false
			};
			const AKASH_NET = 'https://raw.githubusercontent.com/ovrclk/net/master/'+this.AKASH_NETWORK
			
			
			let CHAIN_ID = '';
			const request = https.request(options,response=>{
				//another chunk of data has been received, so append it to `str`
				
				response.on('data', (chunk) => {
					CHAIN_ID += chunk.toString().replace(/\n/gi,'').trim();
				});

				//the whole response has been received, so we just print it out here
				response.on('end', () => {
					process.env.AKASH_CHAIN_ID = CHAIN_ID;
					process.env.AKASH_NET = AKASH_NET;
					const moniker = generator({words: 4}).dashed;
					process.env.AKASH_MONIKER = moniker;
					fs.writeFileSync(`${process.env.HOME}/.HandyHost/aktData/moniker`,moniker,'utf8');
					const s = spawn('./bin/akash',['init','--chain-id',CHAIN_ID,moniker],{env:process.env,cwd:process.env.HOME+'/.HandyHost/aktData'});
					console.log('init akt chain id',CHAIN_ID,moniker);
					/*s.stdout.on('data',d=>{
						console.log('stdout',d.toString());
					})
					s.stderr.on('data',d=>{
						console.log('stderr',d.toString());
					})*/
					s.on('close',()=>{
						this.fetchGenesis().then(()=>{
							this.addSeedsToConfig();
						}).catch(error=>{
							console.log('error fetching genesis',error);
						})
						
						resolve(moniker);
					})

					//resolve(json);

				});

				if(response.statusCode.toString() != '200'){
					//something went wrong
					reject(CHAIN_ID);
				}
			});
			request.end();
		});
	}
	fetchGenesis(){
		return new Promise((resolve,reject)=>{
			const options = {
				host: 'raw.githubusercontent.com',
				port:'443',
				path: `/ovrclk/net/master/${this.AKASH_NETWORK}/genesis.json`,
				method:'GET',
				rejectUnauthorized: true,
				requestCert: true,
				agent: false
			};
			let genesis = '';
			console.log('start genesis request');
			const request = https.request(options,response=>{
				response.on('data', (chunk) => {
					genesis += chunk;
				});

				//the whole response has been received, so we just print it out here
				response.on('end', () => {
					console.log('finished fetching genesis')
					fs.writeFileSync(`${process.env.HOME}/.akash/config/genesis.json`,genesis,'utf8');
					resolve();
				});

				if(response.statusCode.toString() != '200'){
					//something went wrong
					reject(genesis)
					console.log('error getting genesis',response.statusCode.toString());
				}
			});
			request.end();
		});
		
	}
	addSeedsToConfig(){
		//get seeds from akash repo and add to config.toml
		const options = {
			host: 'raw.githubusercontent.com',
			port:'443',
			path: `/ovrclk/net/master/${this.AKASH_NETWORK}/seed-nodes.txt`,
			method:'GET',
			rejectUnauthorized: true,
			requestCert: true,
			agent: false
		};
		
		let seeds = '';
		const request = https.request(options,response=>{
			response.on('data', (chunk) => {
				seeds += chunk;
			});

			//the whole response has been received, so we just print it out here
			response.on('end', () => {
				//we got seeds newline separated, now inject into config
				let seedsCommaSeparated = seeds.trim().split('\n').filter(seed=>{
					return seed.length > 0;
				}).join(',');
				//this.utils.getConfigs().then(configData=>{
					//console.log('configs',configData);
					//configData.node.p2p.seeds.value = `"${seedsCommaSeparated}"`;
				this.utils.updateConfigs({
					node:{
						p2p:{
							seeds:`"${seedsCommaSeparated}"`
						}
					}
				}).then(updated=>{
					console.log('updated config',updated);
				}).catch(error=>{
					console.log('error updating config',error);
				})
				//});
			});

			if(response.statusCode.toString() != '200'){
				//something went wrong
				console.log('error getting seed nodes',response.statusCode.toString());
			}
		});
		request.end();
	}
	initWallet(pw,walletName){
		return new Promise((resolve,reject)=>{
			//const args = ['./createWallet.sh',this.commonUtils.escapeBashString(pw),this.commonUtils.escapeBashString(walletName)];
			let output = '';
			let errOutput = '';
			const args = [
				'--keyring-backend','file',
				'keys', 'add', this.commonUtils.escapeBashString(walletName)
			];
			const s = spawn(`${process.env.HOME}/.HandyHost/aktData/bin/akash`,args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
			s.stdin.write(`${pw}\n`)
			s.stdin.write(`${pw}\n`)
			//const s = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
			//s.stdin.write('(echo derparoo;)');
			s.stdout.on('data',d=>{
				output += d.toString();
			})
			s.stderr.on('data',d=>{
			    errOutput += d.toString();

			    //reject({'error':d.toString()})
			})
			s.stdin.end();
			s.on('close',d=>{
				if(output == '' && errOutput.indexOf('mnemonic') >= 0){
					reject({'error':errOutput});
				}
				else{
					//mnemonic comes back in stderr
					this.finishWalletInit(output,errOutput,walletName,false,resolve);
				}
			    
			})
			
		});
	}
	initWalletFromSeed(seed,pw,walletName){
		return new Promise((resolve,reject)=>{
			//const args = ['./recoverWallet.sh',`"${seed}"`,this.commonUtils.escapeBashString(pw),this.commonUtils.escapeBashString(walletName)];
			let output = '';
			let errOutput = '';
			
			/*
			#$1 = mnemonic
			#$2 = pw
			#$3 = walletname
			(echo "$1"; echo "$2"; echo "$2") | $HOME/.HandyHost/aktData/bin/akash --keyring-backend file keys add "$3" --recover
			*/	
			const args = [
				'--keyring-backend', 'file',
				'keys', 'add', this.commonUtils.escapeBashString(walletName),
				'--recover'
			];
			const s = spawn(`${process.env.HOME}/.HandyHost/aktData/bin/akash`,args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
			s.stdin.write(`${seed}\n`);
			s.stdin.write(`${pw}\n`);
			s.stdin.write(`${pw}\n`);
			//const s = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
			//s.stdin.write('(echo derparoo;)');
			s.stdout.on('data',d=>{
				output += d.toString();
			})
			s.stderr.on('data',d=>{
			    errOutput += d.toString();
			    //reject({'error':d.toString()})
			})
			s.stdin.end();
			s.on('close',d=>{
				if(output == ''){
					reject({error:errOutput})
				}
			    //console.log('spawn closed',d);
			    this.finishWalletInit(output,errOutput,walletName,true,resolve);
			})
		});
	}
	finishWalletInit(output,stderrOutput,walletName,isInitFromSeed,resolve){
		const outputData = {};
		output.split('\n').filter(d=>{
	    	return d.length > 0;
	    }).map(rec=>{
	    	let parts = rec.split(':');
	    	if(parts.length > 1){
	    		let key = parts[0].trim().toLowerCase();
	    		if(key == '- name'){
	    			key = 'name';
	    		}
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
	    if(typeof outputData.mnemonic != "undefined" && !isInitFromSeed){
	    	//get mnemonic from stderr
			let lines = stderrOutput.split('\n').filter(line=>{
				return line.length > 0;
			});
			outputData.mnemonic = lines[lines.length-1].trim();
			
	    }
	    

	    resolve(outputData);
	}
	getKeyList(pw){
		return new Promise((resolve,reject)=>{
			//const args = ['./listKeys.sh',this.commonUtils.escapeBashString(pw)];
			let output = '';
			const args = [
				'keys', 
				'list',
				'--keyring-backend', 'file'
			];
			const s = spawn(`${process.env.HOME}/.HandyHost/aktData/bin/akash`,args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
			s.stdin.write(`${pw}\n`);
			s.stdin.write(`${pw}\n`);
			//const s = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
			//s.stdin.write('(echo derparoo;)');
			s.stdout.on('data',d=>{
				output += d.toString();
			})
			s.stderr.on('data',d=>{
			    console.log('stderr',d.toString());
			    reject({'error':d.toString()})
			})
			s.stdin.end();
			//TODO need to format properly for AKT
			s.on('close',d=>{
				const allowedKeys = ['name','address'];
				let outputData = [];
			    let nextRecord = {};
			    output.split('\n').filter(d=>{
			    	return d.length > 0;
			    }).map(rec=>{
			    	let parts = rec.split(':');
			    	if(parts.length > 1){
			    		if(parts[0].indexOf('- ') == 0){
			    			//console.log('set new record',nextRecord);
			    			if(Object.keys(nextRecord).length > 0){
			    				outputData.push(nextRecord);
			    			}
			    			nextRecord = {};
			    		}
			    		let key = parts[0].trim().toLowerCase().replace('- ','')
			    		if(allowedKeys.indexOf(key) >= 0){
			    			nextRecord[key] = parts[1].trim();
			    		}
			    	}
			    });
			    if(Object.keys(nextRecord).length > 0){
			    	outputData.push(nextRecord);
				}
			    resolve(outputData);
			})
		})
	}
	getQRCode(address){
		return new Promise((resolve,reject)=>{
			resolve(QRCode.toDataURL(address));
		})
		
	}
	getBalance(address){
		
		return new Promise((resolve,reject)=>{
			//get public IP for them at least..
			const args = [
				'query',
				'bank',
				'balances',
				address,
				'--output',
				'json'
			];
			new Promise((balanceResolve,balanceReject)=>{
				this.tryBalanceQuery(args,balanceResolve,balanceReject,1);
			}).then(balanceOutput=>{
				this.getQRCode(address).then(qrData=>{
					const balanceData = {
						balance:balanceOutput,
						qr:qrData
					};
					resolve(balanceData);
				});
			}).catch(error=>{
				reject({error});
			})
			
		});
	}
	tryBalanceQuery(args,resolve,reject,attemptCount){
		let output = '';
		let errOut = '';
		
		const s = spawn('./bin/akash',args,{shell:true,env:process.env,cwd:process.env.HOME+'/.HandyHost/aktData'});
		s.stdout.on('data',d=>{
			output += d.toString();
		})
		s.stderr.on('data',d=>{
			console.log('AKT: get balance query error',d.toString());
			errOut += d.toString();
		});
		s.on('close',()=>{
			if(errOut != ''){
				if(errOut.indexOf('Error: post failed') >= 0 && errOut.indexOf('EOF') >= 0){
					//rpc error, retry...
					if(attemptCount >= 10){
						console.log('reset env attempt is too many, failing now...')
						reject({error:errOut})
						return;
					}
					console.log('RPC request failed, reset env and try again...')
					this.envUtils.setEnv().then(()=>{
						console.log('reset env attempt',attemptCount)
						setTimeout(()=>{
							this.tryBalanceQuery(args,resolve,reject,attemptCount+1);
						},1000)
						
					}).catch(e=>{
						console.log('failed to reset env, retrying...')
						setTimeout(()=>{
							this.tryBalanceQuery(args,resolve,reject,attemptCount+1);
						},1000)
						
					}); //reset env on fail
				}
				else{
					reject({error:errOut});
				}
				
				
			}
			else{
				let json = {};
				try{
					json = JSON.parse(output);
				}
				catch(e){
					reject({error:output})
				}
				//console.log('wallet balance query was successful');
				resolve(json);
			}
		});
	}
	getProviderRegistrationStatus(){
		return new Promise((resolve,reject)=>{
			this.tryGettingProviderRegistrationStatus(resolve,reject,0)
		})
	}
	tryGettingProviderRegistrationStatus(resolve,reject,attempts){
		const configPath = process.env.HOME+'/.HandyHost/aktData/clusterConfig.json';
		if(!fs.existsSync(configPath)){
			resolve(false);
			return;
		}
		const configJSON = JSON.parse(fs.readFileSync(configPath,'utf8'))
		if(typeof configJSON.provider == "undefined"){
			resolve(false);
			return;
		}
		const address = configJSON.provider.providerWalletAddress;
		const args = ['query', 'provider', 'get', address, '--output', 'json'];
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
			if(regErr.indexOf('invalid provider') >= 0){
				reject(false);
				//socketIONamespace.to('akt').emit('providerRegistrationEvent',{dasValidRegistration:false, exists:false, hasValidCertificate: providerHasGeneratedCert,wallet:configJSON.provider.providerWalletAddress});
			}
			else{
				let json = {};
				try{
					json = JSON.parse(regOut);
				}
				catch(e){
					console.log('couldnt parse stdout',regOut);
					if(attempts >= 10){
						reject(false);
					}
					else{
						attempts += 1;
						setTimeout(()=>{
							console.log('attempting again,',attempts);
							this.tryGettingProviderRegistrationStatus(resolve,reject,attempts);
						},1000)
					}
					//reject(false);
					return;
				}
				if(Object.keys(json).length > 0){
					//ok compare and notify if needed
					const config = json;
					
					let isMatch = true;
					if(config.host_uri != `https://${configJSON.provider.providerIP}:8443`){
						isMatch = false;
					}
					const region = config.attributes.find(d=>{return d.key == 'region';})
					const host = config.attributes.find(d=>{return d.key == 'host';});
					if(typeof region == "undefined"){
						isMatch = false;
					}
					else{
						if(region.value != configJSON.provider.regionName){
							isMatch = false;
						}
					}
					if(typeof host == "undefined"){
						isMatch = false;
					}else{
						if(host.value != configJSON.provider.clusterName){
							isMatch = false;
						}
					}
					if(!isMatch){
						
						resolve(false);
					}
					else{
						fs.writeFileSync(process.env.HOME+'/.HandyHost/aktData/providerReceipt.'+configJSON.provider.providerWalletAddress+'.json',JSON.stringify(config),'utf8');
						resolve(true);
					}
				}
			}
		});
	}
	registerProvider(params,mode,providerHost,isGasEstimate){
		return new Promise((resolve,reject)=>{
			//console.log('register called',params,mode);
			const fees = typeof params.fees != "undefined" ? (params.fees == "" ? '10000' : params.fees) : '10000';
			//const args = ['./registerProvider.sh',this.commonUtils.escapeBashString(params.pw),this.commonUtils.escapeBashString(params.walletName),mode,fees];
			let gas = isGasEstimate ? 'auto' : ( typeof params.gas != "undefined" ? params.gas : 'auto' )
			const args = [
				'tx', 'provider', mode,
				`${process.env.HOME}/.HandyHost/aktData/provider.yaml`,
				'--from', this.commonUtils.escapeBashString(params.walletName),
				`--home=${process.env.HOME}/.akash`,
				'--keyring-backend=file',
				`--node=${process.env.AKASH_NODE}`,
				`--chain-id=${process.env.AKASH_CHAIN_ID}`,
				'--fees', `${fees}uakt`,
				'--gas', gas,
				'-y'
			];
			if(isGasEstimate){
				args.push('--dry-run');
			}
			const s = spawn(`${process.env.HOME}/.HandyHost/aktData/bin/akash`,args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
			let output = '';
			let errOutput = '';
			s.stdin.write(`${params.pw}\n`)
			s.stdout.on('data',d=>{
				output += d.toString();
			})
			s.stderr.on('data',d=>{
				errOutput += d.toString();
			})
			s.stdin.end();
			s.on('close',d=>{
				//console.log('output',output);
				if(output == '' && errOutput.length >= 0){
					if(errOutput.indexOf('invalid provider: already exists') >= 0 && mode == 'create'){
						//try update, provider must have switched computers/cleaned disk...
						console.log('recurse, already exists',errOutput);
						this.registerProvider(params,'update',providerHost).then(d=>{
							resolve(d);
						}).catch(e=>{
							reject(e);
						})
					}
					else{
						//todo: catch timeouts...
						//timed out waiting for tx to be included in a block
						if(errOutput.indexOf('timed out waiting for tx to be included in a block') >= 0){
							const timesToCheck = 10;
							let iterations = 0;
							console.log('timed out waiting for tx...');
							const checkInterval = setInterval(()=>{
								//check for next 5 blocks
								this.getProviderRegistrationStatus().then(isRegistered=>{
									console.log('check interval',iterations);
									if(isRegistered){
										resolve({success:true,message:"Successfully Registered Provider"})
										clearInterval(checkInterval);
									}
									else{
										iterations++;
										if(iterations >= timesToCheck){
											clearInterval(checkInterval);
											reject({error:true,message:"Waited 10 blocks for transaction to be included in a block, registration was not updated..."})
										}
									}
								}).catch(e=>{
									iterations++;
									console.log('error fetching provider registration',e);
								})
							},8000)
						}
						else if(isGasEstimate){
							resolve({data:errOutput});
							return;
						}
						else{
							reject({error:true,message:errOutput});
							return;
						}
						
						
					}
				}
				else{
					//TODO set registration tx, return
					let jsonOut;
					try{
						jsonOut = JSON.parse(output);
					}
					catch(e){
						resolve({error:true,message:output});
						return;
					}
					const code = jsonOut.code;
					const codespace = jsonOut.codespace;

					if(codespace == 'provider' && code == 4){
						//redundant
						resolve({success:true,message:'Provider is already registered.'})
					}
					if(codespace == '' && code == 0){
						const {tx,wallet} = this.getMetaFromTransaction(jsonOut);
						fs.writeFileSync(process.env.HOME+'/.HandyHost/aktData/providerReceipt.'+wallet+'.json',JSON.stringify(jsonOut),'utf8');
						const actioned = mode == 'create' ? 'Registered' : 'Updated';
						if(params.generateCert){
							//console.log('done with tx 1, create cert now');
							this.createOrUpdateServerCertificate(params,wallet,providerHost).then(result=>{
								let serverMessageSuccess = '';
								let serverErrorMessage = '';
								if(result.success){
									serverMessageSuccess = ' and Server Certificate';
								}
								else{
									serverErrorMessage = '. However the Server Certificate failed due to: '+result.message;
								}
								resolve({success:true,tx,wallet,message:'Provider'+serverMessageSuccess+' '+actioned+' Successfully'+serverErrorMessage});
							})
						}
						else{
							resolve({success:true,tx,wallet,message:'Provider '+actioned+' Successfully'});
						}
						
					}
					if(codespace == 'sdk'){
						resolve({error:true,message:jsonOut.raw_log})
					}
					
				}
			    
			})
		});
	}
	checkProviderUpStatus(){
		return new Promise((resolve,reject)=>{
			const options = {
				host: '127.0.0.1',
				port:'8443',
				path: '/status',
				method:'GET',
				rejectUnauthorized: false,
				requestCert: true,
				agent: false
			};
			
			let output = '';
			const request = https.request(options,response=>{
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
					//TODO: if provider is already running (restarted app)
					//we need to start the 4-hour restart timer
					if(typeof this.timedRestartTimeout == "undefined"){
						this.setProviderRestartTimeout();
					}
					resolve(json);

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
		});
	}
	autostartProvider(){
		const autostartFile = process.env.HOME+'/.HandyHost/aktData/autostart.json';
		
		if(fs.existsSync(autostartFile)){
			const params = JSON.parse(fs.readFileSync(autostartFile,'utf8'));
			if(typeof process.env.AKTAUTO != "undefined"){
				const encFilePath = process.env.HOME+'/.HandyHost/keystore/'+process.env.AKTAUTO;
				if(fs.existsSync(encFilePath)){
					this.commonUtils.decrypt(encFilePath).then(pw=>{
						params.pw = pw;
						this.checkProviderUpStatus().then(d=>{
							console.log('autostart: akt provider is already running');
						}).catch(e=>{
							this.startProvider(params);
							
						})
					})
				}
				else{
					console.log('no akt enc autostart found')
				}
			}
			else{
				if(process.platform == 'darwin'){
					//is macos
					this.commonUtils.getDarwinKeychainPW('HANDYHOST_AKTAUTO').then(data=>{
						if(data.exists){
							params.pw = data.value;

							this.checkProviderUpStatus().then(d=>{
								console.log('autostart: akt provider is already running');
							}).catch(e=>{
								this.startProvider(params);
							})
						}
						else{
							console.log('no darwin akt autostart params exist');
						}
					})
				}
				else{
					console.log('no akt autostart params present');
					//remove configs if present
					if(typeof process.env.AKTAUTO != "undefined"){
						const encFilePath = process.env.HOME+'/.HandyHost/keystore/'+process.env.AKTAUTO;
						if(fs.existsSync(encFilePath)){
							this.commonUtils.decrypt(encFilePath).then(p=>{})
						}
					}
				}
			}

			//this.startProvider(params);
		}
		else{
			//autoconfig doesnt exist but might have recently
			//so we remove any encrypted creds that got generated for us
			if(process.platform != 'darwin'){
				if(typeof process.env.AKTAUTO != "undefined"){
					const encFilePath = process.env.HOME+'/.HandyHost/keystore/'+process.env.AKTAUTO;
					if(fs.existsSync(encFilePath)){
						//remove the config if it exists
						this.commonUtils.decrypt(encFilePath).then(p=>{})
					}
				}
			}
			//TODO: if provider is already running (restarted app)
			//we need to start the 4-hour restart timer
			this.checkProviderUpStatus().then(d=>{
				console.log('akt provider is already running');
			}).catch(e=>{
				//do nothing
			})
		}
	}
	setupProviderAutostart(params,doAutostart){
		//auto start provider on app startup
		const autostartFile = process.env.HOME+'/.HandyHost/aktData/autostart.json';
		if(doAutostart){
			let stripped = JSON.parse(JSON.stringify(params));
			delete stripped.pw;
			fs.writeFileSync(autostartFile,JSON.stringify(stripped),'utf8');
			if(process.platform == 'darwin'){
				this.commonUtils.setDarwinKeychainPW(params.pw,'HANDYHOST_AKTAUTO');
			}	
			else{
				this.commonUtils.encrypt(params.pw,true,'akt');
			}
		}
		else{
			if(fs.existsSync(autostartFile)){
				fs.unlinkSync(autostartFile);
			}
		}
	}
	setProviderRestartTimeout(){
		/*
		akash provider can freeze up but stay a zombie process sometimes
		thus we will kill it every 4 hours and restart
		*/
		const logsPath = process.env.HOME+'/.HandyHost/aktData/providerRun.log';
		if(typeof this.timedRestartTimeout != "undefined"){
			clearTimeout(this.timedRestartTimeout);
			delete this.timedRestartTimeout;
		}
		this.timedRestartTimeout = setTimeout(()=>{
			this.wasTimedRestart = true;
			console.log('doing periodic akash restart',new Date())
			fs.appendFileSync(logsPath,"\n###########  Provider Restart (every 4-hours) Initiated... ###########\n",'utf8');
			this.killAkashZombies();
		},60*1000*60*4); //4 hours
	}
	startProvider(params){
		if(this.providerPaused){
			//we pause the provider during updates
			setTimeout(()=>{
				this.startProvider(params);
			},10000)
			return;
		}
		//params = walletName,serverHost,prob password????
		return new Promise((resolve,reject)=>{
			let logInterval;
			//unfortunately this command doesnt accept a pw as stdin
			//so we encrypt to a readonly file and pass to the expect script
			//the expect script deletes the encrypted file after reading it.
			this.commonUtils.checkForM1RosettaFun().then(isRosetta=>{
		  		const homebrewPrefixMAC = isRosetta ? '/opt/homebrew' : '/usr/local';
				let opensslLoc;
				//const homebrewPrefixMAC = process.arch == 'arm64' ? '/opt/homebrew' : '/usr/local';
			  	if(process.platform == 'darwin'){
					opensslLoc = homebrewPrefixMAC+'/opt/openssl@1.1/bin/openssl'
				}
				else{
					opensslLoc = 'openssl'
				}
				this.commonUtils.encrypt(params.pw).then(pwLoc=>{
					const args = [pwLoc,params.walletName,params.serverHost,params.cpuPrice,params.fees,opensslLoc];
					const s = spawn('./runProviderAutomated.sh',args,{env:process.env,cwd:process.env.PWD+'/aktAPI',detached:true});
					fs.writeFileSync(process.env.HOME+'/.HandyHost/aktData/provider.pid',s.pid.toString());
					let logsPath = process.env.HOME+'/.HandyHost/aktData/providerRun.log';
					
					this.wasTimedRestart = false; //were going to restart akash provider every few hours because it tends to die a lot...
					this.setProviderRestartTimeout();

					if(fs.existsSync(logsPath)){
						//unlink if exists
						fs.unlinkSync(logsPath);
					}
					let intervalsPassed = 0;
					logInterval = setInterval(()=>{
						intervalsPassed += 1;
						if(intervalsPassed >= 180){
							intervalsPassed = 0;
							fs.truncateSync(logsPath); //clear logs
						}
						fs.appendFileSync(logsPath,output,'utf8');
						output = '';

					},10*1000);
					let hasReturned = false;
					let returnTimeout = setTimeout(()=>{
						if(!hasReturned){
							resolve({success:true});
						}
					},2000);
					
					let output = '';
					s.stdout.on('data',d=>{
						//console.log('stdout',d.toString());
						let shouldLog = true;
						const logVal = d.toString();
						if(logVal.indexOf('Enter keyring passphrase') >= 0){
							shouldLog = false;
						}
						if(logVal.indexOf(params.pw) >= 0){
							shouldLog = false;
						}
						if(logVal.indexOf('spawn ./runProvider.sh') >= 0){
							shouldLog = false;
						}
						if(shouldLog){
							output += logVal;
						}

						
					})
					s.stderr.on('data',d=>{
						//console.log('provider stderr:',d.toString());
						//output += d.toString();
						let shouldLog = true;
						const logVal = d.toString();
						if(logVal.indexOf('Enter keyring passphrase') >= 0){
							shouldLog = false;
						}
						if(logVal.indexOf(params.pw) >= 0){
							shouldLog = false;
						}
						if(logVal.indexOf('spawn ./runProvider.sh') >= 0){
							shouldLog = false;
						}
						if(shouldLog){
							output += logVal;
						}
					})
					s.on('close',()=>{
						console.log('provider is closed');
						fs.appendFileSync(logsPath,"\n###########  PROVIDER WAS CLOSED ###########\n",'utf8');
						hasReturned = true;
						clearTimeout(returnTimeout);
						clearInterval(logInterval);
						if(typeof this.timedRestartTimeout != "undefined"){
							clearTimeout(this.timedRestartTimeout);
							delete this.timedRestartTimeout;
						}
						
						resolve({success:false,error:output});
						
						if(this.providerWasHalted){
							//let it die
							this.providerWasHalted = false;
							if(fs.existsSync(process.env.HOME+'/.HandyHost/aktData/provider.pid')){
								fs.unlinkSync(process.env.HOME+'/.HandyHost/aktData/provider.pid');
								this.killAkashZombies(); //make double sure we killed the provider because sometimes we get zombies lingering...
							}
						}
						else if(this.wasTimedRestart){
							//ok we restarted akash on the 4th hour..
							console.log('initializing akash 4-hour restart zombie prevention routine...')
							this.wasTimedRestart = false;
							setTimeout(()=>{
								fs.appendFileSync(logsPath,"\n###########  PERIODICALLY RESTARTING PROVIDER ###########\n",'utf8');
								console.log('starting akash provider');
								this.startProvider(params);
							},10000)
							
						}
						else{
							this.killAkashZombies().then(()=>{
								console.log('akash provider crashed, restart it...',new Date());
								//make fn sure we dont have multiple akash providers running
								fs.appendFileSync(logsPath,"\n###########  RESTARTING PROVIDER ###########\n",'utf8');
							
								//accidental death, likely due to RPC errors
								//keep things alive
								this.envUtils.setEnv().then(()=>{
									//ok we set the env
									setTimeout(()=>{
										this.startProvider(params);
									},4000); //give it time to spin down post kill zombies
									
								}).catch(e=>{
									console.log('error setting new envs',e);
									//try spawning again anyway
									setTimeout(()=>{
										this.startProvider(params);
									},4000); //give it time to spin down post kill zombies
									
								})
							})
							

						}
					})
				});
			});
				
		});
	}
	killAkashZombies(){
		//for whatever reason sometimes process.kill wont kill akash
		//so lets fn go nuclear on akash then...
		return new Promise((resolve,reject)=>{
			const s = spawn('pkill',['-9','akash']);
			s.stdout.on('data',d=>{
				//resolve(d.toString());
			});
			s.stderr.on('data',d=>{
				//resolve(d.toString());
			});
			s.on('close',()=>{
				resolve(true);
			});
		});
	}
	pauseProvider(){
		this.providerPaused = true;
		//now kill the provider. it will attempt auto-restart
		//however since providerpaused==true we will keep trying
		return new Promise((resolve,reject)=>{
			const pidPath = process.env.HOME+'/.HandyHost/aktData/provider.pid';
			if(fs.existsSync(pidPath)){
				const pid = parseInt(fs.readFileSync(pidPath,'utf8').trim());
				console.log('killing provider at',pid);
				try{
					process.kill(pid);
				}
				catch(e){
					console.log('couldnt kill provider process',e);
				}
				fs.unlinkSync(pidPath);
				resolve(true)
			}
			else{
				resolve(true);
			}
		})
	}
	unpauseProvider(){
		console.log('provider was unpaused');
		this.providerPaused = false;
	}
	haltProvider(){
		this.providerWasHalted = true;
		return new Promise((resolve,reject)=>{
			const pidPath = process.env.HOME+'/.HandyHost/aktData/provider.pid';
			if(fs.existsSync(pidPath)){
				const pid = parseInt(fs.readFileSync(pidPath,'utf8').trim());
				process.kill(pid);
				fs.unlinkSync(pidPath);
				resolve({success:true});
			}
			else{
				//ok must laready be dead
				resolve({success:true});
			}
			this.killAkashZombies(); //make sure we killed it.
		})
	}
	createOrUpdateServerCertificate(params,wallet,providerHost,isGasEstimate){
		//params = {pw,walletName}
		//if the provider registration was updated lets refresh/revoke the certificate in case they changed the server hostname/IP
		return new Promise((resolve,reject)=>{
			const certPath = process.env.HOME+'/.akash/'+wallet+'.pem';
			if(fs.existsSync(certPath) && !isGasEstimate){
				//remove the cert
				fs.unlinkSync(certPath);
			}
			//confirm transaction before signing and broadcasting [y/N]: y
			let createOut = '';
			let errorOut = '';
			this.commonUtils.encrypt(params.pw).then(encPath=>{
				this.commonUtils.checkForM1RosettaFun().then(isRosetta=>{
		  			const homebrewPrefixMAC = isRosetta ? '/opt/homebrew' : '/usr/local';
		  			//const homebrewPrefixMAC = process.arch == 'arm64' ? '/opt/homebrew' : '/usr/local';
			  		const openssl = process.platform == 'darwin' ? homebrewPrefixMAC+'/opt/openssl@1.1/bin/openssl' : 'openssl';
			  		const fees = typeof params.fees != "undefined" ? (params.fees == "" ? '10000' : params.fees) : '10000';
			  		const gas = typeof params.gas != "undefined" ? (params.gas) : 'auto';
					let args = [encPath,this.commonUtils.escapeBashString(params.walletName),providerHost,fees,openssl,gas];
					
					let output = '';
					let errOutput = '';
					
					const s = spawn('./createProviderCertAutomated.sh',args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
					s.stdout.on('data',d=>{
						output += d.toString();
					})
					s.stderr.on('data',d=>{
						errOutput += d.toString();
					})
					s.on('close',()=>{
						console.log('cert output',output)
						console.log('cert err? ',errOutput);
						//all done, check if we did it..
						let successful = false;
						let message = '';
						const testStr = 'transaction successful:y';
						if(output.indexOf(testStr) >= 0){
							let json = {};
							const msgParts = output.split(testStr);
							try{
								json = JSON.parse(msgParts[1].trim());
							}
							catch(e){
								console.log("no json here");
								if(errOutput == ''){
									if(msgParts.length > 1){
										message = msgParts[1]
									}
									
								}
								else{
									message = errOutput;
								}
								
							}
							if(typeof json.code != "undefined"){
								if(json.code == 0){
									//success
									successful = true;
									message = 'Akash Server Certificate Generated Successfully';
								}
								else{
									message = json.raw_log;
								}
							}
							resolve({success:successful,message})
						}
						if(output == '' && errOutput != ''){
							resolve({success:successful,message:errOutput})
						}
					})
				});//rosetta fun
			})
			
		})
		

	}

	getMetaFromTransaction(receipt){
		const txID = receipt.txhash;
		let wallet;
		const meta = receipt.logs;
		if(meta.length > 0){
			meta[0].events.map(event=>{
				if(event.type == 'message'){
					const sender = event.attributes.find(attrib=>{
						return attrib.key == 'sender';
					})
					wallet = sender.value;
				}
			})
		}
		return {tx:txID,wallet};
	}
}