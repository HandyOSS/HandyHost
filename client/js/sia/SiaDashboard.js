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
		this.walletInfo.setSyncedStatus(walletData.height,chainData.height);
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