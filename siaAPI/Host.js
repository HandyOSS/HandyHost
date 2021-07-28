import {siacCommand, siacPostDataCommand} from './helper.js';

export class Host{
	constructor(){

	}
	getHostInfo(){
		return siacCommand('host','GET');/*.then(d=>{
			console.log('host stats',d);
		}).catch(e=>{
			console.error('ERROR GETTING HOST INFO',e);
		});*/
	}
	getHostBandwidth(){
		siacCommand('host/bandwidth','GET').then(d=>{
			console.log('host bandwidth stats',d);
		}).catch(e=>{
			console.error('ERROR GETTING HOST BANDWIDTH INFO',e);
		});
	}
	updateHostParameters(options){
		let optsString = '';
		Object.keys(options).map((key,i)=>{
			let delim = i == 0 ? '?' : '&';
			optsString += delim;
			optsString += key+'='+options[key];
		});
		//acceptingcontracts boolean
		//maxdownloadbatchsize bytes
		//maxduration blocks
		//maxrevisebatchsize bytes
		//netaddress string
		//windowsize blocks
		//collateral hastings/byte/block
		//collateralbudget hastings
		//maxcollateral hastings
		//minbaserpcprice hastings
		//mincontractprice hastings
		//minsectoraccessprice hastings
		//mindownloadbandwidthprice hastings/byte
		//minstorageprice hastings/byte/block
		//minuploadbandwidthprice hastings/byte
		//maxephemeralaccountbalance hastings
		//maxephemeralaccountrisk hastings
		//registrysize int
		//customregistrypath string
		return siacPostDataCommand('host'+optsString,'');
		/*

		siacPostDataCommand('wallet/siacoins',`amount=${amountHastings}&destination=${destination}`).then(d=>{
			console.log('sent coins',d);
		}).catch(e=>{
			console.error('ERROR SENDING COIN',e);
		});
		*/

	}
	announceHost(netaddress){
		console.log('announce address',netaddress);
		return siacPostDataCommand(`host/announce?netaddress=${netaddress}`,'')
		//return siacCommand('host/announce','POST');
		/*.then(d=>{
			console.log('host announced stats',d);
		}).catch(e=>{
			console.error('ERROR SETTING HOST ANNOUNCEMENT INFO',e);
		});*/
	}
	getContracts(){
		return siacCommand('host/contracts','GET');/*.then(d=>{
			console.log('host contracts stats',d);
		}).catch(e=>{
			console.error('ERROR GETTING HOST CONTRACTS INFO',e);
		});*/
	}
	getContract(id){
		return siacCommand(`host/contracts/${id}`,'GET');/*.then(d=>{
			console.log('host contract stats',d);
		}).catch(e=>{
			console.error('ERROR GETTING HOST CONTRACT INFO',e);
		});*/
	}
	getStorage(){
		return siacCommand('host/storage','GET');/*.then(d=>{
			console.log('host storage stats',d);
		}).catch(e=>{
			console.error('ERROR GETTING HOST STORAGE INFO',e);
		});*/
	}
	addStorageFolder(path,size){
		//size = bytes
		return siacPostDataCommand('host/storage/folders/add',`path=${path}&size=${size}`);/*.then(d=>{
			console.log('added storage folder',d);
		}).catch(e=>{
			console.error('ERROR ADDING STORAGE FOLDER',e);
		});*/
	}
	removeStorageFolder(path,forceRemove){
		
		return siacPostDataCommand('host/storage/folders/remove',`path=${path}&force=${forceRemove}`);/*.then(d=>{
			console.log('added storage folder',d);
		}).catch(e=>{
			console.error('ERROR ADDING STORAGE FOLDER',e);
		});*/
	}
	resizeStorageFolder(path,size){
		//size = bytes
		return siacPostDataCommand('host/storage/folders/resize',`path=${path}&newsize=${size}`);/*.then(d=>{
			console.log('resized storage folder',d);
		}).catch(e=>{
			console.error('ERROR RESIZING STORAGE FOLDER',e);
		});*/
	}
	deleteSector(merkleRoot){
		///host/storage/sectors/delete/:merkleroot
		siacCommand(`host/storage/sectors/delete/${merkleRoot}`,'POST').then(d=>{
			console.log('host removed sector by merkle root stats',d);
		}).catch(e=>{
			console.error('ERROR DELETING SECTOR BY MERKLE INFO',e);
		});
	}
	estimateScore(){
		return siacCommand('host/estimatescore','GET');/*.then(d=>{
			console.log('est. host score stats',d);
		}).catch(e=>{
			console.error('ERROR GETTING EST HOST SCORE INFO',e);
		});*/
	}


}