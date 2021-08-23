import {SiaHostConfig} from './SiaHostConfig.js';
import {SiaStorageConfig} from './SiaStorageConfig.js';
import {SiaWalletConfig} from './SiaWalletConfig.js';
import {SiaWalletInfo} from './SiaWalletInfo.js';
import {SiaContracts} from './SiaContracts.js';
import {HostScoreRadarChart, ContractsChart, EarningsStorageChart} from './SiaCharts.js';
import {Theme} from '../ColorTheme.js';

export class SiaDashboard {
	constructor(){
		this.theme = new Theme();
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
		this.walletInfo.setSyncedStatus(walletData.height,chainData.height);
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
			}
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