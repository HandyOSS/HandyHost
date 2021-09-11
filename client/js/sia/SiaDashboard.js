import {SiaHostConfig} from './SiaHostConfig.js';
import {SiaStorageConfig} from './SiaStorageConfig.js';
import {SiaWalletConfig} from './SiaWalletConfig.js';
import {SiaWalletInfo} from './SiaWalletInfo.js';
import {SiaContracts} from './SiaContracts.js';
import {HostScoreRadarChart, ContractsChart, EarningsStorageChart} from './SiaCharts.js';
import {Theme} from '../ColorTheme.js';
import {CommonUtils} from '../CommonUtils.js';

export class SiaDashboard {
	constructor(){
		this.theme = new Theme();
		this.utils = new CommonUtils();
		fetch('./uiFragments/sia/dashboard.html').then(res=>res.text()).then(fragment=>{
			$('body').append(fragment);
			//init dashboard
			this.initDashboard();
			this.theme.applyColorTheme(localStorage.getItem('theme'));
			/*$(window).on('resize',()=>{
				console.log('do resize');
				this.resize();
			})*/
			window.onresize = ()=>{
				this.resize();
			}
		})
		this.hostConfig = new SiaHostConfig();
		this.storageConfig = new SiaStorageConfig();
		this.walletConfig = new SiaWalletConfig();
		this.walletInfo = new SiaWalletInfo();
		this.contracts = new SiaContracts();

		this.socket = io('/sia');
		this.socket.on('connect',()=>{
			console.log('socket connected');
		})
		this.socket.on('register',()=>{
			console.log('received register event, subscribing');
			this.socket.emit('subscribe');
		})
		this.socket.on('update',(data)=>{
			console.log('realtime updates',data);
			this.doRealtimeUpdates(data);
		})
		this.socket.on('HandyHostUpdatesAvailable',data=>{
			console.log('handyhost updates are available',data);
			this.notifyHandyHostUpdates(data);
		})
		this.socket.on('HandyHostIsUpToDate',data=>{
			$('.options li#handyhostUpdatesWarning').hide();
		})

		
		
	}
	show(){
		$('.dashboard').show();
		this.radarChart.updateHostStats();
		this.contractsChart.showContractsData();
		this.earningsStorageChart.fetchData();
	}
	hide(){
		$('.dashboard').hide();
	}
	doRealtimeUpdates(data){
		const walletData = data.wallet;
		const chainData = data.chain;
		const updateData = data.updates;
		if(updateData.available){
			this.enableUpdateModal(updateData,data.daemon);
		}
		this.enableWarningsModal(data.config);
		this.walletInfo.setSyncedStatus(walletData.height,chainData.height,chainData.synced);
	}	
	enableUpdateModal(updateData,versionCurrentData){
		
		const installed = versionCurrentData.version;
		const latest = updateData.version;
		$('#updateSCModal .updateInfo').html('Sia Updates are Available.<br />Installed: '+installed+'<br />Latest: '+latest)
		$('#updateSia').show();
		$('#updateSia').off('click').on('click',()=>{
			this.showUpdateModal();
		});
	}
	enableWarningsModal(configData){

		let $warnings = $('<ul />');
		let hasWarnings = false;
		let collateralbudget = hastingsToSiacoins(configData.collateralbudget).toNumber()
		let lockedcollateral = hastingsToSiacoins(configData.lockedcollateral).toNumber();
		//to test::
		//	lockedcollateral = collateralbudget - 50;
		//end test
		if(Math.abs(collateralbudget - lockedcollateral) <= 100 && configData.acceptingcontracts){
			$warnings.append('<li><span class="emoji">⚠️</span> Locked Collateral is nearing your Collateral Budget. <br />Locked: '+(Math.floor(lockedcollateral*100)/100)+' SC, Budget: '+(Math.floor(collateralbudget*100)/100)+'. <br />Not increasing your collateral budget will result in no new contracts.</li>')
			hasWarnings = true;
		}
		$('.warningsInfo').html($warnings);
		if(hasWarnings){
			$('#warnings').show();
			$('#warnings').off('click').on('click',()=>{
				this.showWarningsModal();
			})
		}

	}
	showWarningsModal(){
		$('#warningsSCModal').show();
		$('#warningsSCModal .warningsModal').addClass('showing');
		$('#warningsSCModal #closeModal').off('click').on('click',()=>{
			$('#warningsSCModal').hide();
			$('#warnings').hide();
		});
		$('#warningsSC').off('click').on('click',()=>{
			$('#warningsSCModal').hide();
			$('#warnings').hide();
		})
	}
	showUpdateModal(){
		$('#updateSCModal').show();
		$('#updateSCModal .launchModal').addClass('showing');
		$('#updateSCModal #closeModal').off('click').on('click',()=>{
			$('#updateSCModal').hide();
		});
		$('#updateSC').off('click').on('click',()=>{
			if($('#updateSCModal').hasClass('isUpdating')){
				return false;
			}
			$('#updateAKT .foreground, #updateAKT .background').html('🚀 Updating 🚀');
			$('#updateAKT').addClass('isUpdating');
			fetch('/api/sia/updateSia').then(d=>d.json()).then(d=>{
				$('.updateInfo').html('SUCCESSFULLY UPDATED!!')
				setTimeout(()=>{
					$('#updateSCModal').hide();//.removeClass('showing');
					$('#updateAKT').removeClass('isUpdating');
					$('#updateAKT .foreground, #updateAKT .background').html('Update 🚀');
				},2000);
			});

		})
		$('#cancelUpdate').off('click').on('click',()=>{
			$('#updateSCModal').hide();
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
		$('#updateHandyHostModal #closeModal').off('click').on('click',()=>{
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
				$('#updateHandyHostModal').hide();
			})
		});
		$('#updateHandyHostModal #cancelHandyHostUpdate').off('click').on('click',()=>{
			$('#updateHandyHostModal').hide();
		})
		
	}
	initDashboard(){
		const _this = this;
		this.radarChart = new HostScoreRadarChart($('#siaMain .dashboard .hostScore'));
		this.contractsChart = new ContractsChart($('#siaMain .dashboard .contractsChart'));
		this.earningsStorageChart = new EarningsStorageChart($('#siaMain .dashboard .earningsChart'),$('#siaMain .dashboard .storageChart'));
		this.show();
		$('#siaMain .options li').off('click').on('click',function(){
			const id = $(this).attr('id');
			switch(id){
				case 'dashboard':
					_this.walletInfo.hide();
					_this.storageConfig.hide();
					_this.hostConfig.hide();
					_this.walletConfig.hide();
					_this.show();
				break;
				case 'wallet':
					_this.walletInfo.show();
					_this.storageConfig.hide();
					_this.hostConfig.hide();
					_this.walletConfig.hide();
					_this.hide();
				break;
				case 'storage':
					_this.storageConfig.show();
					_this.walletInfo.hide();
					_this.hostConfig.hide();
					_this.walletConfig.hide();
					_this.hide();
				break;
				case 'hosting':
					_this.hostConfig.show();
					_this.walletInfo.hide();
					_this.storageConfig.hide();
					_this.walletConfig.hide();
					_this.hide();
				break;
				case 'switchWallet':
					_this.walletConfig.show();
					/*_this.walletInfo.hide();
					_this.storageConfig.hide();
					_this.hostConfig.hide();
					_this.hide();*/
				break;
				case 'toggleTheme':
					_this.theme.toggleColorTheme();
				break;
				case 'allServices':
					window.location.href = '/';
				break;
				case 'handyhostUpdatesWarning':
					_this.nodeStatus.showHandyHostUpdateModal();
				break;
			}
		})
		this.utils.getIP().then(data=>{
			$('.options #ipDisplay').remove();
			$('.options').append('<div id="ipDisplay">Network URL: <span>'+data.ip+':'+data.port+'</span></div>')
		})
		this.initMobileMenu();
	}
	resize(doImmediately){
		const resizeTime = doImmediately ? 1 : 500;
		if(typeof this.resizeTimeout != "undefined"){
			clearTimeout(this.resizeTimeout);
			delete this.resizeTimeout;
		}
		this.resizeTimeout = setTimeout(()=>{
			console.log('performing resize');
			this.earningsStorageChart.resize();
			this.radarChart.resize();
			this.contractsChart.chart.simulation.stop();
			this.contractsChart.resize();
		},resizeTime);
		
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
				this.resize(true);
			},250)
		})
	}
}