import {AKTNodeConfig} from './AKTNodeConfig.js';
import {AKTClusterStatus} from './AKTClusterStatus.js';
import {AKTMarketplace} from './AKTMarketplace.js';
import {Theme} from '../ColorTheme.js';

export class AKTDashboard {
	constructor(){
		this.theme = new Theme();
		this.nodeConfig = new AKTNodeConfig();
		this.clusterStatus = new AKTClusterStatus(this);
		this.marketplace = new AKTMarketplace(this);
		fetch('./uiFragments/akt/dashboard.html').then(res=>res.text()).then(fragment=>{
			$('body').append(fragment);
			//init dashboard
			this.initDashboard();
			this.theme.applyColorTheme(localStorage.getItem('theme'));
			this.initMobileMenu()
		})
		

		this.socket = io('/akt');
		this.socket.on('connect',()=>{
			console.log('socket connected');
		})
		this.socket.on('register',()=>{
			console.log('received register event, subscribing');
			this.socket.emit('subscribe');
		})
		this.socket.on('update',(data)=>{
			this.doRealtimeUpdates(data);
		})
		this.socket.on('k8sBuildLogs',data=>{
			console.log('k8sBuildLogs',data);
			this.nodeConfig.clusterConfig.updateLogs(data);
			if(!$('#logs').hasClass('showing')){
				//in case we refreshed
				$('#logs .logsMessage').html('Kubernetes cluster build is running, it will take at least 5-10 minutes...');
			}
			$('#logs').addClass('showing');
			//this.clusterStatus.updateLogs(data);
		})
		this.socket.on('k8sBuildLogStatus',data=>{
			console.log('k8sBuildLogStatus',data.part,data.status);
			this.nodeConfig.clusterConfig.updateLogs('========= '+data.part+' is '+data.status+' ==========');
			if(data.part == 'init'){
				$('#logs .logsMessage').html('Kubernetes Cluster Installation is Finished!')
			}
		})
		
	}
	show(){
		$('.dashboard').show();
	}
	hide(){
		$('.dashboard').hide();
	}
	doRealtimeUpdates(data){
		console.log('realtime update',data);
		/*const walletData = data.wallet;
		const chainData = data.chain;
		this.walletInfo.setSyncedStatus(walletData.height,chainData.height);*/
	}
	initDashboard(){
		const _this = this;
		fetch('/api/akt/getState').then(d=>d.json()).then(json=>{
			console.log('state',json);
			//json.exists = false;

			if(!json.exists){
				this.nodeConfig.showWalletInit();
			}
			//this.nodeStatus.setStatus(json.active);
		})
		/*fetch('/api/dvpn/getState').then(d=>d.json()).then(json=>{
			console.log('state',json);
			//json.exists = false;

			if(!json.exists){
				this.nodeConfig.showWalletInit();
			}
			this.nodeStatus.setStatus(json.active);
			if(json.exists && json.logs != ''){

				this.nodeStatus.addBulkLogs(json.logs);
			}
			//else{
				//this.nodeConfig.getNodeConfigData();
			//}
		}).catch(e=>{
			console.log('error',e);
		})*/
		$('#aktMain .options li').off('click').on('click',function(){
			const id = $(this).attr('id');
			switch(id){
				case 'dashboard':

				break;
				case 'config':
					_this.nodeConfig.getNodeConfigData();
					_this.clusterStatus.hide();
					_this.marketplace.hide();
				break;
				case 'status':
					_this.nodeConfig.hide();
					_this.clusterStatus.show();
					_this.marketplace.hide();
				break;
				case 'newwallet':
					_this.nodeConfig.showWalletInit();
				break;
				case 'toggleTheme':
					_this.theme.toggleColorTheme();
				break;
				case 'market':
					_this.clusterStatus.hide();
					_this.nodeConfig.hide();
					_this.marketplace.show();
				break;
				case 'providerStatus':
					//needs to show modal and run provider, then hide it on success
					_this.showRunProviderModal();
				break;
			}
			
		})
	}
	
	hideModal(){
		$('.walletModalContent').removeClass('showing');
		$('#runProviderModal').hide();
		$('#unlockRunPW').val('');
		$('.walletUtil').addClass('showing');
	}
	showRunProviderModal(){
		$('#closeRunProviderModal').off('click').on('click',()=>{
			this.hideModal();
		})
		const label = 'Run Akash Provider';
		$('#runSave .foreground').html(label);
		$('#runSave .background').html(label);
		$('#runProviderModal').show();
		$('.walletModalContent').removeClass('showing');
		$('.runProviderModal').addClass('showing');
		
		$('#runSave').off('click').on('click',()=>{
			$('#runSave .foreground').html('Starting Up...');
			$('#runSave .background').html('Starting Up...');
			
			const runProviderData = {
				pw:$('#unlockRunPW').val()
			};
			fetch("/api/akt/runProvider",
			{
			    headers: {
			      'Accept': 'application/json',
			      'Content-Type': 'application/json'
			    },
			    method: "POST",
			    body: JSON.stringify(runProviderData)
			})
			.then((res)=>{ console.log('success'); return res.json(); }).then(data=>{
				console.log('res data',data);
				if(data.error){
					this.showErrorModal(data.message);
				}
				else{
					let msg = data.message;
					if(typeof msg == "undefined"){
						msg = 'Started Provider Successfully!';
					}
					this.verifyRun(msg);
				}
				$('#runSave .foreground').html(label);
				$('#runSave .background').html(label);
			
			})
			.catch((res)=>{ console.log('error submitting',res) });
		})
		$('#cancelRun').off('click').on('click',()=>{
			this.hideModal();
		})
		
	}
	showErrorModal(message){
		$('.runMessage .error').html('ERROR: '+message);
		$('.runMessage .error').show();
		$('.runMessage .success').hide();
		$('.runProviderModal').removeClass('showing');
		$('.runMessage').addClass('showing');
		this.handleVerifyModalHide(true);
	}
	verifyRun(message){
		console.log('verify data',message);
		//$('.messageText').html('a wallet aaddress')
		$('.runMessage .success .messageText').html(message);
		
		$('.runMessage .error').hide();
		$('.runMessage .success').show();
		$('.runProviderModal').removeClass('showing');
		$('.runMessage').addClass('showing');
		this.clusterStatus.fetchStats();
		this.handleVerifyModalHide();

	}
	handleVerifyModalHide(wasError){
		$('#runMessageConf').off('click').on('click',()=>{
			this.hideModal()
			if(wasError){
				//this.showRunProviderModal();
				//leave it hidden
			}
			else{
				this.clusterStatus.fetchStats();
			}
		})
	}
	initMobileMenu(){
		$('.settingsButton').off('click').on('click',()=>{
			const isClicked = $('.settingsButton').hasClass('clicked');
			if(isClicked){
			    $('.settingsButton').removeClass('clicked');
			    $('body').removeClass('menuShowing');
			}
			else{
			    $('.settingsButton').addClass('clicked');
			    $('body').addClass('menuShowing');
			}
			//TODO trigger resize
			setTimeout(()=>{
				//this.resize(true);
			},250)
		})
	}
}