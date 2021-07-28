import {spawn} from 'child_process';
export class UpdateHelper{
	constructor(){

	}
	checkForUpdates(){
		return new Promise((resolve,reject)=>{
			const args = ['./dvpnAPI/checkUpdates.sh'];
			const s = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD});
			let output = '';
			s.stdout.on('data',d=>{
				output += d.toString();
			})
			s.stderr.on('data',d=>{
			    console.log('stderr',d.toString());
			    reject({'error':d.toString()})
			})
			s.on('close',d=>{
				let json = {};
				try{
					json = JSON.parse(output);
				}
				catch(e){
					console.log('couldnt parse json output of dvpn tag',output)
				}
				if(typeof json.all != "undefined"){
					json.all = json.all.filter(tag=>{
						return tag.indexOf('rc') == -1;
					})
				}
				resolve(json);
			})
		})
	}
	updateDVPN(socketIONamespace){
		return new Promise((resolve,reject)=>{
			this.checkForUpdates().then(data=>{
				const latest = data.all[data.all.length-1];
				console.log('latest tag to checkout',latest)
				const args = ['./dvpnAPI/updateDVPN.sh',latest]
				const s = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD});
				let output = '';
				let hadError = false;
				s.stdout.on('data',d=>{
					socketIONamespace.to('dvpn').emit('logs',d.toString());
				})
				s.stderr.on('data',d=>{
					console.log('dvpn udpate stderr ',d.toString());
				    socketIONamespace.to('dvpn').emit('logs',d.toString());
				})
				s.on('close',d=>{
					resolve()
				})
			})
			//socketIONamespace.to('dvpn').emit('logs',d.toString());
		})
	}
}