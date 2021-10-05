export class CommonUtils{
	constructor(){

	}
	getIP(){
		return new Promise((resolve,reject)=>{
			fetch('/api/getIP').then(d=>d.json()).then(data=>{
				resolve(data);
			})
		})
		
	}
	getIntroVersionInfo(){
		//get version info for the intro screen
		let meta = {};
		let finished = 0;
		let total = 4;
		const aktSocket = io('/akt');
		aktSocket.on('register',()=>{
			aktSocket.emit('getAppStatus');
		});
		aktSocket.on('versionStatus',(aktVersionStatus)=>{
			meta.Akash = aktVersionStatus;
			finished++;
			finish();
			console.log('akt version status',aktVersionStatus);
		});
		const dvpnSocket = io('/dvpn');
		dvpnSocket.on('register',()=>{
			dvpnSocket.emit('getAppStatus');
			
		});
		dvpnSocket.on('versionStatus',(dvpnVersionStatus)=>{
			meta.DVPN = dvpnVersionStatus;
			finished++;
			finish();
			console.log('dvpn version status',dvpnVersionStatus)
		});
		dvpnSocket.on('handyhostVersionStatus',(handyhostVersionStatus)=>{
			meta.HandyHost = handyhostVersionStatus;
			finished++;
			finish();
			console.log('handyhost version status',handyhostVersionStatus);
		});
		const siaSocket = io('/sia');
		siaSocket.on('register',()=>{
			siaSocket.emit('getAppStatus');
			
		});
		siaSocket.on('versionStatus',(siaVersionStatus)=>{
			meta.Sia = siaVersionStatus;
			finished++;
			finish();
			console.log('sia version status',siaVersionStatus);
		});
		function finish(){
			/*if(finished != total){
				return;
			}*/
			const $ul = $('ul.versionInfo');
			let ordered = Object.keys(meta).filter(key=>{
				return key != "HandyHost"
			});
			ordered = ['HandyHost'].concat(ordered);
			ordered.map(name=>{
				const data = meta[name];
				let version = '';
				let needsUpdateClass = '';
				if(typeof data == "undefined"){
					return;
				}
				if(typeof data.current != "undefined"){
					version = data.current;
					if(typeof data.latest != "undefined"){
						if(!data.isUpToDate){
							version += " / "+data.latest
							version = '<span class="emoji">⚠️</span>'+version;
							needsUpdateClass = ' needsUpdate';
						}
						else{
							version = ' '+version;
						}
					}
				}
				const $li = $(`<li class="${name}">${name} <span class="version${needsUpdateClass}">${version}</span></li>`)
				if(name != 'HandyHost'){
					if(data.active){
						$li.append('<span class="badge green"></span>')
					}
					else{
						$li.append('<span class="badge grey"></span>')
					}
				}
				$ul.find('li.'+name).replaceWith($li);
			})
			//$('#appVersionMeta').html($ul);
		}
	}
}