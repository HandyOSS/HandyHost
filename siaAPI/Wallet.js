import {siacCommand, siacPostDataCommand} from './helper.js';

export class Wallet{
	constructor(){

	}
	getWalletInfo(){
		return siacCommand('wallet','GET');/*.then(d=>{
			console.log('wallet stats',d);
		}).catch(e=>{
			console.error('ERROR GETTING WALLET INFO',e);
		});*/
	}
	getWalletAddress(){
		return siacCommand('wallet/address','GET',true);/*.then(d=>{
			console.log('got address',d);
		}).catch(e=>{
			console.error('ERROR GETTING WALLET ADDRESS',e);
		});*/
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
		return siacPostDataCommand(`wallet/init`,`encryptionpassword=${encryptionpw}&force=true`);/*.then(d=>{
			console.log('initialized new wallet',d);
		}).catch(e=>{
			console.error("ERROR INIT WALLET",e);
		});*/
	}
	initWalletFromSeed(seedStr,encryptionpw){
		const seed = seedStr.trim();

		return siacPostDataCommand('wallet/init/seed',`seed=${seed}&encryptionpassword=${encryptionpw}&force=true`);/*.then(d=>{
			console.log('initialized wallet from seed',d);
		}).catch(e=>{
			console.error('ERROR INIT WALLET FROM SEED',e);
		});*/
	}
	sendCoins(amountHastings,destination){
		return siacPostDataCommand('wallet/siacoins',`amount=${amountHastings}&destination=${destination}`);/*.then(d=>{
			console.log('sent coins',d);
		}).catch(e=>{
			console.error('ERROR SENDING COIN',e);
		});*/
	}
	lockWallet(){
		siacCommand('wallet/lock','POST').then(d=>{
			console.log('locked wallet',d);
		}).catch(e=>{
			console.error('ERROR LOCKING WALLET',d);
		});
	}
	unlockWallet(encryptionpw){
		return siacPostDataCommand('wallet/unlock',`encryptionpassword=${encryptionpw}`);/*.then(d=>{
			console.log('unlocked wallet',d);
		}).catch(e=>{
			console.error('ERROR UNLOCKING WALLET',e);
		});*/
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