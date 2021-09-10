import {DVPNNodeConfig} from './DVPNNodeConfig.js';
import {DVPNNodeStatus} from './DVPNNodeStatus.js';
import {DVPNDashboardAnalytics} from './DVPNDashboardAnalytics.js';
import {Theme} from '../ColorTheme.js';
import {CommonUtils} from '../CommonUtils.js';

export class DVPNDashboard {
	constructor(){
		this.theme = new Theme();
		this.utils = new CommonUtils();
		this.nodeConfig = new DVPNNodeConfig();
		this.nodeStatus = new DVPNNodeStatus(this);
		this.dashboardAnalytics = new DVPNDashboardAnalytics(this);
		fetch('./uiFragments/dvpn/dashboard.html').then(res=>res.text()).then(fragment=>{
			$('body').append(fragment);
			//init dashboard
			this.initDashboard();
			this.theme.applyColorTheme(localStorage.getItem('theme'));
			this.initMobileMenu();
		})
		

		this.socket = io('/dvpn');
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
		this.socket.on('logs',data=>{
			this.nodeStatus.updateLogs(data);
		})
		this.socket.on('status',status=>{
			const isConnected = status == 'disconnected' ? false : true;
			this.nodeStatus.setStatus(isConnected)
		})
		this.socket.on('updatesAvailable',updateData=>{
			//dvpn node has updates via github.
			console.log('socket node udpates updatesAvailable',updateData)
			this.notifyUpdates(updateData);
		})
		this.socket.on('nodeIsUpToDate',()=>{
			console.log('socket node is updated')
			$('#dvpnMain .options li#dvpnUpdatesWarning').hide();
		});
		this.socket.on('sessionAnalytics',(data,timeseries)=>{
			console.log('session analytics realtime update',data);
			this.dashboardAnalytics.renderSessionsRealtime(data);
		})
		this.socket.on('HandyHostUpdatesAvailable',data=>{
			console.log('handyhost updates are available',data);
			this.notifyHandyHostUpdates(data);
		})
		this.socket.on('HandyHostIsUpToDate',data=>{
			$('#dvpnMain .options li#handyhostUpdatesWarning').hide();
		})
		/*
		if(!data.isUpToDate){
			this.ioNamespace.to('dvpn').emit('HandyHostUpdatesAvailable',data);
		}
		else{
			this.ioNamespace.to('dvpn').emit('HandyHostIsUpToDate',data);
		}
		*/
		
	}
	notifyUpdates(data){
		//notify via UI of updates
		$('#dvpnMain .options li#dvpnUpdatesWarning').show();
		this.nodeStatus.prepareUpdatesPanel(data);
	}
	notifyHandyHostUpdates(data){
		$('#dvpnMain .options li#handyhostUpdatesWarning').show();
		this.nodeStatus.prepareHandyHostUpdatesPanel(data);
	}
	show(){
		this.fetchDashboardData();
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
	fetchDashboardData(){
		fetch('/api/dvpn/getDashboardStats').then(d=>d.json()).then(json=>{
			
			this.dashboardAnalytics.renderAnalytics(json);
		})
	}
	initDashboard(){
		const _this = this;
		_this.nodeStatus.hide();
		_this.nodeConfig.hide();
		_this.show();
		fetch('/api/dvpn/getState').then(d=>d.json()).then(json=>{
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
		})
		$('#dvpnMain .options li').off('click').on('click',function(){
			const id = $(this).attr('id');
			switch(id){
				case 'dashboard':
					_this.nodeStatus.hide();
					_this.nodeConfig.hide();
					_this.show();
				break;
				case 'config':
					_this.nodeConfig.getNodeConfigData();
					_this.nodeStatus.hide();
					_this.hide();
				break;
				case 'status':
					_this.nodeConfig.hide();
					_this.nodeStatus.show();
					_this.hide();
				break;
				case 'newwallet':
					_this.nodeConfig.showWalletInit();
				break;
				case 'toggleTheme':
					_this.theme.toggleColorTheme();
				break;
				case 'dvpnUpdatesWarning':
					_this.nodeConfig.hide();
					_this.nodeStatus.show();
					_this.nodeStatus.showDVPNUpdateModal()
				break;
				case 'handyhostUpdatesWarning':
					_this.nodeStatus.showHandyHostUpdateModal();
				break;
				case 'allServices':
					window.location.href = '/';
				break;
			}
			
		})
		this.utils.getIP().then(data=>{
			$('.options #ipDisplay').remove();
			$('.options').append('<div id="ipDisplay">Network URL: <span>'+data.ip+':'+data.port+'</span></div>')
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