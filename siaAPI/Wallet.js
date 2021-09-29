import {siacCommand, siacPostDataCommand} from './helper.js';

export class Wallet{
	constructor(){

	}
	getWalletInfo(){
		return siacCommand('wallet','GET');
	}
	getWalletAddress(){
		return siacCommand('wallet/address','GET',true);
	}
	getLatestWalletAddress(){
		return siacCommand('wallet/seedaddrs?count=1','GET');
	}
	changeWalletPassword(oldpw,newpw){
		siacCommand(`wallet/changepassword?encryptionpassword=${oldpw}&newpassword=${newpw}`,'POST').then(d=>{
			console.log('changed password',d);
		}).catch(e=>{
			console.error('ERROR CHANGING WALLET PASSWORD',e);
		});
	}
	initWallet(encryptionpw){
		return siacPostDataCommand(`wallet/init`,`encryptionpassword=${encryptionpw}&force=true`);
	}
	initWalletFromSeed(seedStr,encryptionpw){
		const seed = seedStr.trim();

		return siacPostDataCommand('wallet/init/seed',`seed=${seed}&encryptionpassword=${encryptionpw}&force=true`);
	}
	sendCoins(amountHastings,destination){
		return siacPostDataCommand('wallet/siacoins',`amount=${amountHastings}&destination=${destination}`);
	}
	lockWallet(){
		siacCommand('wallet/lock','POST').then(d=>{
			console.log('locked wallet',d);
		}).catch(e=>{
			console.error('ERROR LOCKING WALLET',d);
		});
	}
	unlockWallet(encryptionpw){
		return siacPostDataCommand('wallet/unlock',`encryptionpassword=${encryptionpw}`);
	}
	verifyWallet(address){
		siacCommand(`wallet/verify/address/${address}`,'GET').then(d=>{
			console.log('verified address',d);
		}).catch(e=>{
			console.error('error verifying address',e);
		});
	}
	getRecentTransactions(){
		return siacCommand('wallet/transactions?startheight=0&endheight=-1','GET');
	}
}