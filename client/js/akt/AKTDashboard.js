import {AKTNodeConfig} from './AKTNodeConfig.js';
import {AKTClusterStatus} from './AKTClusterStatus.js';
import {AKTMarketplace} from './AKTMarketplace.js';
import {Theme} from '../ColorTheme.js';
import {CommonUtils} from '../CommonUtils.js';

export class AKTDashboard {
	constructor(){
		this.ansi_up = new AnsiUp();
		this.theme = new Theme();
		this.utils = new CommonUtils();
		this.nodeConfig = new AKTNodeConfig(this);
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
		this.socket.on('marketAggregatesUpdate',data=>{
			this.marketAggregatesUpdate(data);
		})
		this.socket.on('k8sBuildLogs',data=>{
			//console.log('k8sBuildLogs',data);
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
				if(this.nodeConfig.clusterConfig.kubernetesHasError){
					//cannot access '/etc/kubernetes/admin.conf': No such file or directory
					$('#logs .logsMessage').html('There were errors installing Kubernetes. Please check the logs below and try again. <small>Common issues include setting up your internet router local DNS settings, your Akash nodes being offline or IP changes.</small>')
				}
				else{
					$('#logs .logsMessage').html('Kubernetes Cluster Installation is Finished!<br />Check your certificates and registration in the Dashboard and then start making $AKT<br /><small>Note: Dashboard stats will take a few minutes to connect.</small>')
				}
				
				setTimeout(()=>{
					this.clusterStatus.fetchStats();
				},5000)
			}
		})
		this.socket.on('newNodeRegistered',(nodeData,clusterConfig)=>{
			console.log('new node data',nodeData,clusterConfig);
			this.nodeConfig.clusterConfig.updateConfiguratorNodes(clusterConfig);
			this.nodeConfig.clusterConfig.renderClusterConfig(clusterConfig);
			this.showNewNodeAddedModal(nodeData);
		})
		this.socket.on('akashInstallLogs',data=>{
			$('#updateAKTModal .updateInfo').html('Log: '+data);
		})
		this.socket.on('HandyHostUpdatesAvailable',data=>{
			console.log('handyhost updates are available',data);
			this.notifyHandyHostUpdates(data);
		})
		this.socket.on('HandyHostIsUpToDate',data=>{
			$('.options li#handyhostUpdatesWarning').hide();
		})
		this.socket.on('providerRegistrationEvent',data=>{
			this.nodeConfig.clusterConfig.updateConfiguratorRegistrationStatus(data)
			console.log('is provider up to date?',data);
			if(!data.hasValidRegistration){
				//show .option for registration
				//if !exists we know to create vs update
				const action = data.exists ? 'update' : 'create';
				$('.options #providerRegistrationWarning').attr('data-wallet',data.wallet);
				$('.options #providerRegistrationWarning').attr('data-action',action)
				if(action == 'create'){
					$('.options #providerRegistrationWarning .action').html('');
				}
				else{
					$('.options #providerRegistrationWarning .action').html('Update');	
				}
				$('.options #providerRegistrationWarning').show();
			}
			else{
				$('.options #providerRegistrationWarning').hide();
			}
			if(!data.hasValidCertificate){
				//show .option for cert gen
				$('.options #providerCertificateWarning').attr('data-wallet',data.wallet);
				$('.options #providerCertificateWarning').show();
			}
			else{
				$('.options #providerCertificateWarning').hide();
			}
		})
		this.socket.on('kubesprayVersionStatus',data=>{
			console.log('kubespray version status',data);
			if(data.local != data.latest && data.latest.trim() != ''){
				//show kubespray update option
				//ensure its not blank
				$('.options #kubesprayUpdateAvailable').show();
				$('.options #kubesprayUpdateAvailable').off('click').on('click',()=>{
					//show modal
					this.showKubesprayUpdateModal(data);
				})
			}
		})
		this.socket.on('kubesprayUpdateLogs',(data,isDone)=>{
			this.showKubesprayUpdateLogs(data,isDone);
		})
		this.socket.on('flashUSBStatus',logInfo=>{
			$('#autoConfigx86 .statusLogs').html('Status: '+logInfo);
			$('#autoConfigx86 .statusLogs').show();
		})
		
	}
	
	show(){
		//$('.dashboard').show();
		this.nodeConfig.hide();
		this.clusterStatus.show();
		this.marketplace.hide();
	}
	hide(){
		$('.dashboard').hide();
	}
	marketAggregatesUpdate(data){
		this.clusterStatus.marketAggsUpdate(data);
		console.log('market aggs update',data);
	}
	doRealtimeUpdates(data){
		console.log('realtime update',data);
		this.clusterStatus.realtimeUpdate(data);
		let podSum = 0;
		if(typeof data.k8s != "undefined"){
			data.k8s.map(node=>{
				podSum = node.realtime.pods;
			})
		}
		if(typeof this.podsActive == "undefined"){
			this.podsActive = podSum;
		}
		else{
			//check for difference and notify
			const diff = podSum - this.podsActive;
			if(diff != 0){
				let msg = '';
				let action;
				if(diff < 0){
					action = ' Ended';
				}
				if(diff > 0){
					action = ' Started';
				}
				const absVal = Math.abs(diff);
				let label = ' Instance';
				if(absVal > 1){
					' Instances';
				}
				msg = absVal+label+action;
				/*
				deprecating this, it's not adding much value tbh
				$('#aktMain .options ul').append('<li id="changeMessage">'+msg+'</li>')
				$('li#changeMessage').fadeOut(15000);
				setTimeout(()=>{
					$('li#changeMessage').remove();
				},15000)*/
			}
		}
		if(data.providerIsRunning){
			$('.options li#providerStatus').hide();
		}
		else{
			if(data.providerHasGeneratedCert && data.providerIsRegistered){
				$('.options li#providerStatus').show();
			}
		}
		//need to update?
		this.showUpdateOpts(data.akashVersion);
		
		/*const walletData = data.wallet;
		const chainData = data.chain;
		this.walletInfo.setSyncedStatus(walletData.height,chainData.height);*/
	}
	showUpdateOpts(versionData){
		if(versionData.installed != versionData.latest){
			//show update opts
			$('#updateAkash').show();
			$('#updateAKTModal .updateInfo').html('Installed: '+versionData.installed+'<br />Latest: '+versionData.latest);
		}
		else{
			//hide update opts
			$('#updateAkash').hide();
		}
	}
	showUpdateModal(){
		$('#updateAKTModal').show();
		$('#updateAKTModal .launchModal').addClass('showing');
		$('#updateAKTModal .closeModal').off('click').on('click',()=>{
			$('#updateAKTModal').hide();
		});
		$('#updateAKT').off('click').on('click',()=>{
			if($('#updateAKTModal').hasClass('isUpdating')){
				return false;
			}
			$('#updateAKT .foreground, #updateAKT .background').html('🚀 Updating 🚀');
			$('#updateAKT').addClass('isUpdating');
			fetch('/api/akt/updateAkashToLatest').then(d=>d.json()).then(d=>{
				$('.updateInfo').html('SUCCESSFULLY UPDATED AKASH!! Now we will update our cluster.')
				setTimeout(()=>{
					$('#updateAKTModal').hide();//.removeClass('showing');
					$('#updateAKT').removeClass('isUpdating');
					$('#updateAKT .foreground, #updateAKT .background').html('Update 🚀');
				},2000);
			});

		})
		$('#cancelUpdate').off('click').on('click',()=>{
			$('#updateAKTModal').hide()//.removeClass('showing');
		});
	}
	notifyHandyHostUpdates(data){
		$('.options li#handyhostUpdatesWarning').show();
		this.prepareHandyHostUpdatesPanel(data);
	}
	prepareHandyHostUpdatesPanel(updatesData){
		const currentTag = updatesData.local;
		const nextTag = updatesData.latest;
		const $ul = $('<ul />')
		$ul.append('<div class="updateTitle">Update HandyHost</div>')
		$ul.append('<li>Current: '+currentTag+'</li>')
		$ul.append('<li>Latest: '+nextTag+'</li>')
		$('#updateHandyHostModal .updateInfo').html($ul);
	}
	showHandyHostUpdateModal(){
		//show the modal
		$('#updateHandyHostModal').show();
		$('#updateHandyHostModal .modalContent').addClass('showing');
		$('#updateHandyHostModal .closeModal').off('click').on('click',()=>{
			$('#updateHandyHostModal').hide();
		});
		$('#updateHandyHostModal #updateHandyHost.save').off('click').on('click',()=>{

			//hide this, start the update, on finish hide the update button in the dashboard
			//this.updateLogs('\nStarting DVPN Node Update...\n')
			//$('#updateHandyHostModal').hide();
			$('#updateHandyHostModal #updateHandyHost').removeClass('save').addClass('cancel');
			$('#updateHandyHostModal #updateHandyHost .foreground, #updateHandyHostModal #updateHandyHost .background').html('Updating...');
			fetch('/api/updateHandyHost').then(d=>d.json()).then(json=>{
				console.log('done with update???',json);
				$('#dvpnMain .options li#handyhostUpdatesWarning').hide();
				$('#updateHandyHostModal .updateInfo').html("Update Complete! Reloading in <span class=\"secVal\">20</span>s...")
				let i = 20;
				const reloadInterval = setInterval(()=>{
					i = i-1 <= 0 ? 0 : i-1;
					$('#updateHandyHostModal .secVal').html(i);
				},1000);
				setTimeout(()=>{
					clearInterval(reloadInterval);
					window.location.reload();
				},20000);
				//$('#updateHandyHostModal').hide();
			})
		});
		$('#updateHandyHostModal #cancelHandyHostUpdate').off('click').on('click',()=>{
			$('#updateHandyHostModal').hide();
		})
		
	}
	showKubesprayUpdateLogs(data,isDone){
		if(!$('#updateKubesprayModal .modalContent').hasClass('showing') && !$('#updateKubesprayModal .modalContent').hasClass('logsShowing') ){
			$('#updateKubesprayModal').show();
			$('#updateKubesprayModal .modalContent').addClass('showing');
			$('#updateKubesprayModal .modalContent').addClass('logsShowing');
			$('#updateKubespray').removeClass('save').addClass('cancel');
			$('#updateKubespray .foreground, #updateKubespray .background').html('🚀 Updating...')
			$('#cancelKubesprayUpdate').hide();
			$('#updateKubesprayModal .closeModal').off('click');
			//this may have been triggered by an akash update.
			$('#updateAKTModal').hide();//.removeClass('showing');
			$('#updateAKT').removeClass('isUpdating');
			$('#updateAKT .foreground, #updateAKT .background').html('Update 🚀');
		}
		const message = typeof data == 'object' ? JSON.stringify(data) : data;
		//$('#updateKubesprayModal .updateLogs pre').append(d+'\n');
		if(typeof this.k8sUpdateLogs == "undefined"){
			this.k8sUpdateLogs = []
			$('#updateKubesprayModal .updateLogs pre').html('');
		}
		this.k8sUpdateLogs.push(message);
		if(this.k8sUpdateLogs.length > 500){
			this.k8sUpdateLogs = this.k8sUpdateLogs.slice(-300);
			//redraw all logs
			$('#updateKubesprayModal .updateLogs pre').html('')
			this.k8sUpdateLogs.map(line=>{
				$('#updateKubesprayModal .updateLogs pre').append(line);
			})
		}
		else{
			
			$('#updateKubesprayModal .updateLogs pre').append(this.ansi_up.ansi_to_html(message))
		}
		if($('#updateKubesprayModal .updateLogs pre').height() > $('#updateKubesprayModal .updateLogs').height()){
			const diff = $('#updateKubesprayModal .updateLogs pre').height() - $('#updateKubesprayModal .updateLogs').height();
			$('#updateKubesprayModal .updateLogs').scrollTop(diff);
		}
		if(isDone === true){
			//re-enable closing
			$('#updateKubespray .foreground, #updateKubespray .background').html('🚀 Update Complete!')
			$('#updateKubespray').addClass('doneUpdating')
			$('#updateKubespray').removeClass('cancel').addClass('save');
			$('#cancelKubesprayUpdate').show();
			$('#cancelKubesprayUpdate .foreground, #cancelKubesprayUpdate .background').html('Close Updater');
			$('#cancelKubesprayUpdate').off('click').on('click',()=>{
				$('#updateKubespray .foreground, #updateKubespray .background').html('Update 🚀');
				$('#updateKubesprayModal').hide();
			})
			$('#kubesprayUpdateAvailable').hide();
			this.clusterStatus.fetchStats();
		}
	}
	showKubesprayUpdateModal(data){
		//updateKubesprayModal
		$('#updateKubesprayModal .versionInfo').html(`
			<div class="current">Local Version: ${data.local}</div>
			<div class="latest">Latest Version: ${data.latest}</div>
		`)
		$('#updateKubesprayModal').show();
		$('#updateKubesprayModal .modalContent').addClass('showing');
		$('#cancelKubesprayUpdate .foreground, #cancelKubesprayUpdate .background').html('cancel');
		$('#updateKubespray').off('click').on('click',()=>{
			//perform update
			if($('#updateKubespray').hasClass('cancel') || $('#updateKubespray').hasClass('doneUpdating')){
				return false;
			}
			console.log('trigger update');
			fetch('/api/akt/updateKubespray').then(d=>d.json()).then(data=>{
				console.log('update script done');
			})
			$('#updateKubesprayModal .modalContent').addClass('logsShowing');
			$('#updateKubespray').removeClass('save').addClass('cancel');
			$('#updateKubespray .foreground, #updateKubespray .background').html('🚀 Updating...')
			//after done, cange back to Update 🚀
			$('#cancelKubesprayUpdate').hide();
			$('#updateKubesprayModal .closeModal').off('click');
		})
		$('#cancelKubesprayUpdate').off('click').on('click',()=>{
			$('#updateKubesprayModal').hide();
		})
		$('#updateKubesprayModal .closeModal').off('click').on('click',()=>{
			$('#updateKubesprayModal').hide();
		})
	}
	initDashboard(){
		const _this = this;
		fetch('/api/akt/getState').then(d=>d.json()).then(json=>{
			console.log('state',json);
			//json.exists = false;
			if(json.isAutostart){
				$('#runProviderModal #autostart').prop('checked',true);
			}
			else{
				$('#runProviderModal #autostart').prop('checked',false);
			}
			if(!json.exists){
				this.nodeConfig.showWalletInit();
				this.nodeConfig.show();
			}
			else{
				this.show();
			}
			//this.nodeStatus.setStatus(json.active);
		})
		
		$('#aktMain .options li').off('click').on('click',function(){
			const id = $(this).attr('id');
			switch(id){
				case 'config':
					_this.nodeConfig.getNodeConfigData();
					_this.clusterStatus.hide();
					_this.marketplace.hide();
				break;
				case 'status':
				case 'dashboard':
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
				case 'changeMessage':
					$('li#changeMessage').hide().remove();
				break;
				case 'updateAkash':
					_this.showUpdateModal();
				break;
				case 'allServices':
					window.location.href = '/';
				break;
				case 'providerLogs':
					_this.showProviderLogsModal();
				break;
				case 'handyhostUpdatesWarning':
					_this.showHandyHostUpdateModal();
				break;
				case 'providerRegistrationWarning':
					if($('#providerRegistrationWarning').attr('data-action') == 'create'){
						_this.clusterStatus.showRegistrationModal(false,$('#providerRegistrationWarning').attr('data-wallet'));
					}
					else{
						//update
						_this.clusterStatus.showRegistrationModal(true,$('#providerRegistrationWarning').attr('data-wallet'));
					}
				break;
				case 'providerCertificateWarning':
					_this.clusterStatus.showRegistrationModal(false,$('#providerCertificateWarning').attr('data-wallet'),true);
				break;
				case 'tutorial':
					window.open('https://youtu.be/QV6qhjyQ6dc', '_blank').focus();
				break;
			}
			
		})
		this.utils.getIP().then(data=>{
			$('.options #ipDisplay').remove();
			$('.options').append(`
				<div id="ipDisplay">Network URL: 
					<span>http://${data.ip}:${data.port}</span>
					<span>https://${data.ip}:${data.sslPort}</span>
				</div>`
			);
			$('#ingressPortsMessage .localIP').html(data.ip);
			$('#configurator #configuratorIngressPortsMessage .localIP').html(data.ip);
		})
	}
	
	hideModal(){
		$('.walletModalContent').removeClass('showing');
		$('#runProviderModal').hide();
		$('#providerLogsModal').hide();
		$('#newNodeAddedModal').hide();
		$('#walletInitModal').hide();
		$('#unlockRunPW').val('');
		$('.walletUtil').addClass('showing');
	}
	showNewNodeAddedModal(data){
		this.hideModal();
		$('#closeNewNodeAddedModal').off('click').on('click',()=>{
			this.hideModal();
		});
		$('.addNodeMessage').show();
		$('.addNodeMessage').addClass('showing');
		$('#newNodeAddedModal').show();
		$('.addNodeMessage .messageText').html('<div class="message0">Added an Akash Node named: '+data.hostname+', on IP '+data.ip+' successfully!</div>')
		$('.addNodeMessage .messageText').append('<div class="message1">It is now safe to remove the USB ThumbDrive from the new node, power the node back on and move on to setup other nodes.</div>')
		$('.addNodeMessage .messageText').append('<div class="message1">Your new node is now available to add to your Akash cluster in the Configuration Interface.</div>')
		$('#addedNodeMessageConf').off('click').on('click',()=>{
			this.hideModal();
		})
	}
	showProviderLogsModal(){
		$('#closeProviderLogsModal').off('click').on('click',()=>{
			this.hideModal();
		})
		$('#providerLogsModal').show();
		$('.walletModalContent').removeClass('showing');
		$('.providerLogsModal').addClass('showing');
		//fetch logs
		fetch('/api/akt/getProviderLogs').then(d=>d.text()).then(d=>{
			this.updateProviderLogs(d);
		})
		$('#haltProviderSave').off('click').on('click',()=>{
			//todo halt provider process api call
			fetch('/api/akt/haltProvider').then(d=>d.json()).then(d=>{
				//todo make message, update status
				if(d.success){
					this.verifyHalt('Successfully Halted Provider');
					
					$('.providerStat').html('<span class="indicator offline"></span> Provider is Offline')
				}
				else{
					this.showErrorModal(data);
				}
			})
		});
		$('#refreshLogs').off('click').on('click',()=>{
			$('#providerLogsModal pre').html('Fetching Logs...')
			fetch('/api/akt/getProviderLogs').then(d=>d.text()).then(d=>{
				this.updateProviderLogs(d);
			})
		})
	}
	updateProviderLogs(message){
		if(typeof this.logs == "undefined"){
			this.logs = []
			$('#providerLogsModal .logs pre').html('');
		}
		//message.split('\n').map(line=>{
			this.logs.push(message);
			if(this.logs.length > 500){
				this.logs = this.logs.slice(-300);
				//redraw all logs
				$('#providerLogsModal .logs pre').html('')
				this.logs.map(line=>{
					$('.logs pre').append(line);
				})
			}
			else{
				/*let timestring = `<em style="color: yellow;">[${moment().format('MM-DD hh:mm:ssA')}]</em> `;
				if(showTimestamp === false){
					timestring = '';
				}*/
				$('#providerLogsModal .logs pre').append(this.ansi_up.ansi_to_html(message))
			}
			if($('#providerLogsModal .logs pre').height() > $('#providerLogsModal .logs').height()){
				const diff = $('#providerLogsModal .logs pre').height() - $('#providerLogsModal .logs').height();
				$('#providerLogsModal .logs').scrollTop(diff);
			}
		//})
		
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
		/*
		<div class="pwWrap">
			<input type="number" id="runFees" class="styledInput" placeholder="TX fees (default 10000 uAKT)" />
		</div>
		<div class="pricingLabel">Provider Pricing (per block, ~8 seconds)</div>
		<div class="pwWrap">
			<input type="number" id="cpuPrice" class="styledInput" placeholder="uAKT per milliCPU (default 10 uAKT)" />
		</div>
		*/
		$('#runSave').off('click').on('click',()=>{
			const fees = $('#runFees').val() == '' ? 1000 : parseInt($('#runFees').val());
			const cpu = $('#cpuPrice').val() == '' ? 1 : parseFloat($('#cpuPrice').val());
			const autostart = $('#autostart').is(':checked');
			$('#runSave .foreground').html('Starting Up...');
			$('#runSave .background').html('Starting Up...');
			
			const runProviderData = {
				pw:$('#unlockRunPW').val(),
				fees,
				cpu,
				autostart
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
		$('.providerLogsModal').removeClass('showing');
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
		$('.providerLogsModal').removeClass('showing');
		$('.runMessage').addClass('showing');
		$('.options li#providerStatus').hide();
		setTimeout(()=>{
			this.clusterStatus.fetchStats();
		},30000);
		$('#aktMain .options li#providerLogs').show();
		
		$('.providerStat').html('<span class="indicator issue"></span> Provider is Starting Up...')
		this.handleVerifyModalHide();

	}
	verifyHalt(message){
		console.log('verify data',message);
		//$('.messageText').html('a wallet aaddress')
		$('.logsMessage .success .messageText').html(message);
		
		$('.logsMessage .error').hide();
		$('.logsMessage .success').show();
		$('.runProviderModal').removeClass('showing');
		$('.providerLogsModal').removeClass('showing');
		$('.logsMessage').addClass('showing');
		setTimeout(()=>{
			this.clusterStatus.fetchStats();
		},20000);
		$('#providerStatus').show();
		$('#providerLogs').hide();

		
		this.handleVerifyModalHide();

	}
	handleVerifyModalHide(wasError){
		console.log('handleVerifyModalHide called');
		$('#runMessageConf').off('click').on('click',()=>{
			console.log('should close modal');
			this.hideModal()
			/*if(wasError){
				//this.showRunProviderModal();
				//leave it hidden
			}
			else{
				this.clusterStatus.fetchStats();
			}*/
		})
		$('#logsMessageConf').off('click').on('click',()=>{
			this.hideModal()
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