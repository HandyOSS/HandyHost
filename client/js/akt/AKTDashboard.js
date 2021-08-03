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
		this.socket.on('newNodeRegistered',nodeData=>{
			console.log('new node data',nodeData);
			this.showNewNodeAddedModal(nodeData);
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
		$('#newNodeAddedModal').hide();
		$('#unlockRunPW').val('');
		$('.walletUtil').addClass('showing');
	}
	showNewNodeAddedModal(data){
		$('#closeNewNodeAddedModal').off('click').on('click',()=>{
			this.hideModal();
		});
		$('.addNodeMessage').show();
		$('.addNodeMessage').addClass('showing');
		$('#newNodeAddedModal').show();
		$('.addNodeMessage .messageText').html('<div class="message0">Added an Akash Node named: '+data.hostname+', on IP '+data.ip+' successfully!</div>')
		$('.addNodeMessage .messageText').append('<div class="message1">It is now safe to remove the USB ThumbDrive from the new node and setup other nodes.</div>')
		$('.addNodeMessage .messageText').append('<div class="message1">Your new node is now available to add to your Akash cluster in the Configuration Interface.</div>')
		$('#addedNodeMessageConf').off('click').on('click',()=>{
			this.hideModal();
		})
		/*
		<div id="newNodeAddedModal" class="modalWrap">
			<div class="closeModal" id="closeNewNodeAddedModal">
				[close]
			</div>
			<div class="addNodeMessage walletModalContent">
				<div class="logo">
					<img src="./img/AkashAKTLogo.svg" />
				</div>
				<div class="message success">
					<div class="messageIcon">🥳</div>
					<div class="messageText">Started Provider Successful!</div>
				</div>
				<div class="message error"></div>
				<div class="button save" id="addedNodeMessageConf"><div class="foreground">Done</div><div class="background">Done</div></div>
				
			</div>
		</div>
		*/
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