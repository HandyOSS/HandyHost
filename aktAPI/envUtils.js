import https from 'https';
import fs from 'fs';
import {spawn} from 'child_process';
/*
export AKASH_NET="https://raw.githubusercontent.com/ovrclk/net/master/mainnet"
export AKASH_VERSION="$(curl -s "$AKASH_NET/version.txt")"
export AKASH_CHAIN_ID="$(curl -s "$AKASH_NET/chain-id.txt")"
export AKASH_NODE="$(curl -s "$AKASH_NET/rpc-nodes.txt" | shuf -n 1)"
export AKASH_MONIKER="$(cat ~/.HandyHost/aktData/moniker)"
*/
export class EnvUtils{
	constructor(skipCheckInterval){
		this.AKASH_NETWORK = 'mainnet';
		this.AKASH_NET = 'https://raw.githubusercontent.com/ovrclk/net/master/'+this.AKASH_NETWORK
		this.KUBECONFIG = process.env.HOME+'/.HandyHost/aktData/admin.conf';
		this.httpsHost = 'raw.githubusercontent.com';
		this.httpsPathBase = '/ovrclk/net/master/'+this.AKASH_NETWORK;
		
		if(typeof doCheckInterval == "undefined" || !skipCheckInterval){
			//sometimes we just want to call things adhoc.
			//marketplace runs the interval in this case
			//and provider needs to reset things if an rpc node falls over
			this.trySetEnv();
			this.setRPCNodeOnInterval();
		}
		
	}
	trySetEnv(){
		let envTimeout;
		this.setEnv().then().catch(e=>{
			console.log('error setting env',e);
			if(e){
				if(typeof envTimeout != "undefined"){
					clearTimeout(envTimeout);
					envTimeout = undefined;
				}
				envTimeout = setTimeout(()=>{
					this.trySetEnv();
				},10000);
			}
		})
	}
	setEnv(){
		return new Promise((resolve,reject)=>{
			let waitingOn = 3;
			let done = 0;
			process.env.AKASH_NET = this.AKASH_NET;
			this.getChainID().then(id=>{
				//console.log("SET ENV.AKASH_CHAIN_ID",id);
				process.env.AKASH_CHAIN_ID = id;
				done++;
				if(done == waitingOn){
					resolve();
				}
			}).catch(e=>{
				reject(e);
			});
			this.getLocalVersion().then(v=>{
				//console.log("SET ENV.AKASH_VERSION",v);
				process.env.AKASH_VERSION = v;
				done++;
				if(done == waitingOn){
					resolve();
				}
			}).catch(e=>{
				reject(e);
			});
			this.getRPCNode().then(rpcnode=>{
				//console.log("SET ENV.AKASH_NODE",rpcnode);
				process.env.AKASH_NODE = rpcnode;
				done++;
				if(done == waitingOn){
					resolve();
				}
			}).catch(e=>{
				reject(e);
			});
			process.env.AKASH_MONIKER = this.getMoniker();
			process.env.KUBECONFIG = this.KUBECONFIG;
		})
		
	}
	setRPCNodeOnInterval(){
		if(typeof this.rpcSetter == "undefined"){
			this.rpcSetter = setInterval(()=>{
				const currentVersion = process.env.AKASH_VERSION;
				this.setEnv().then(()=>{
					const newVersion = process.env.AKASH_VERSION;
					if(newVersion != currentVersion){
						console.log("!!!!!! NEW AKASH VERSION IS AVAILABLE !!!!!",currentVersion,newVersion);
					}
				})
				
			},1000*360); //reset env every 10 mins to new random rpc node, check for version updates and trigger updates if so
		}
	}
	getChainID(){
		return this.queryHTTPSResponse(`${this.httpsPathBase}/chain-id.txt`);	
	}
	getLocalVersion(){
		return new Promise((resolve,reject)=>{
			//~/.HandyHost/aktData/bin/akash version
			const p = spawn(process.env.HOME+'/.HandyHost/aktData/bin/akash',['version'],{cwd:process.env.PWD+'/aktAPI'});
			let out = '';
			p.stdout.on('data',d=>{
				out += d.toString();
			})
			p.stderr.on('data',d=>{
				console.log('error fetching local akash version',d.toString())
				reject(d.toString());
			})
			p.on('close',()=>{
				resolve(out.trim());
			})
		})
	}
	getLatestVersion(){
		return new Promise((resolve,reject)=>{
			const p = spawn('./getAkashLatestVersion.sh',[],{cwd:process.env.PWD+'/aktAPI'});
			let out = '';
			p.stdout.on('data',d=>{
				out += d.toString();
			})
			p.stderr.on('data',d=>{
				console.log('error fetching latest akash version',d.toString())
				reject(d.toString());
			})
			p.on('close',()=>{
				resolve(out.trim());
			})
		})
	}
	getRPCNode(){
		return new Promise((resolve,reject)=>{
			this.queryHTTPSResponse(`${this.httpsPathBase}/rpc-nodes.txt`).then(nodes=>{
				//ok so according to this post: https://forum.akash.network/t/tips-rpc-endpoint-and-api-endpoint-address-list/1006
				//there are a few nodes that are more stable than others
				//most of the 135.181* are busts so we'll cut them out
				
				const nodeList = nodes.split('http').filter(n=>{
					return n.trim().length > 0;
				}).map(n=>{
					return 'http'+n;
				}).filter(n=>{
					//forbole is returning http responses to https client
					//breaking all kinds of shite
					if(n.indexOf('rpc.akash.forbole.com') >= 0){
						return false;
					}
					if(n.indexOf('135.181') >= 0){
						return false;
					}
					if(n.indexOf(process.env.AKASH_NODE) >= 0){
						//dont use the current node that just failed
						return false;
					}
					return true;
				});
				const handyHostNodes = [
					'http://rpc-1.handyhost.computer:26657'/*,
					'http://rpc-2.handyhost.computer:26657'*/
				];
				if(handyHostNodes.indexOf(process.env.AKASH_NODE) == -1){
					//first try one our our own rpc nodes.
					//however if we had a failure, choose another
					resolve(handyHostNodes[Math.floor(Math.random() * (handyHostNodes.length-1))]);
				}
				else{
					// /console.log('nodelist',nodeList);
					//get a random node
					resolve(nodeList[Math.floor(Math.random() * (nodeList.length-0.01))]);
				}
				
			}).catch(e=>{
				reject(e);
			})
		});
	}
	getMoniker(){
		const monikerPath = process.env.HOME+'/.HandyHost/aktData/moniker'
		if(fs.existsSync(monikerPath)){
			return fs.readFileSync(monikerPath,'utf8').trim();
		}
		else{
			return '';
		}
	}
	queryHTTPSResponse(path){
		return new Promise((resolve,reject)=>{
			const options = {
				host: this.httpsHost,
				port:'443',
				path: path,
				method:'GET',
				rejectUnauthorized: true,
				requestCert: true,
				agent: false
			};
			
			
			
			let RESP = '';
			const request = https.request(options,response=>{
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
					reject(RESP);
				}
			});
			request.on('error',e=>{
				reject(e);
			})
			request.end();
		})
	}
}