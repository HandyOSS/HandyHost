import {siacoinsToHastings, hastingsToSiacoins} from './siaUtils.js';
window.siacoinsToHastings = siacoinsToHastings;
window.hastingsToSiacoins = hastingsToSiacoins;

export class SiaContracts{
	constructor(){

	}
	getContractsData(){
		fetch('/api/sia/getContracts').then(d=>d.json()).then(data=>{
			console.log('contracts',data);
			this.showData(data);
		}).catch(e=>{
			console.log('contracts render error',e);
		})
	}
	showData(data){
		let lockedCollateralSum = 0;
		let storageSum = 0;
		let uploadSum = 0;
		let downloadSum = 0;
		let proofOutputSum = 0;
		data.contracts.map(contract=>{
			let collateral = contract.lockedcollateral;
			lockedCollateralSum += hastingsToSiacoins(collateral).toNumber();
			let negotationHeight = contract.negotiationheight;
			let proofDeadlineHeight = contract.proofdeadline;
			let riskedCollateral = contract.riskedcollateral;
			let txid = contract.transactionid;

			let validProofOutputRenter = contract.validproofoutputs[0].value;
			
			let validProofOutputHost = contract.validproofoutputs[1].value;
			proofOutputSum += hastingsToSiacoins(validProofOutputHost).toNumber();

			let storageRev = contract.potentialstoragerevenue;
			storageSum += hastingsToSiacoins(storageRev).toNumber();

			let uploadRev = contract.potentialuploadrevenue;
			uploadSum += hastingsToSiacoins(uploadRev).toNumber();

			let downloadRev = contract.potentialdownloadrevenue;
			downloadSum += hastingsToSiacoins(downloadRev).toNumber();

			let datasize = contract.datasize;

		});
		console.log('locked sum',lockedCollateralSum);//,hastingsToSiacoins(lockedCollateralSum).toNumber());
		console.log('storage rev sum',storageSum);//,hastingsToSiacoins(storageSum).toNumber());
		console.log('upload rev sum',uploadSum);//,hastingsToSiacoins(uploadSum).toNumber());
		console.log('download rev sum',downloadSum);//,hastingsToSiacoins(downloadSum).toNumber());
		console.log('proof output sum',proofOutputSum);//,hastingsToSiacoins(proofOutputSum).toNumber());

		let potentialIN = storageSum + uploadSum + downloadSum + proofOutputSum
	}
}