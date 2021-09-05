import {spawn} from 'child_process'; 
export class CommonUtils{
	constructor(){
		this.port = process.env.HANDYHOST_PORT || 8008;
	}
	getIPForDisplay(){
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
			  resolve({ip:ipOut,port:this.port});
			});
		});

	}
}