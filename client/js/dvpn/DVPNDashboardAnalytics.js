import {StreamGraph} from '../charts/StreamGraph.js';
import {DonutChart} from '../charts/DonutChart.js';

export class DVPNDashboardAnalytics{
	constructor(parentComponent){
		this.parentComponent = parentComponent;
		
	}
	renderAnalytics(data){
		const analytics = data.analytics;
		const balance = data.balance;
		const addressMeta = data.wallet;
		let node = data.node;
		console.log('data IN',data);
		let isConnected = true;
		if(Object.keys(data.node).length == 0){
			isConnected = false;
			node = {
				result:{
					moniker: '<div class="monikerWrap"><span class="warningEmoji">⚠️</span> Node Offline</div>',
					offline:true,
					bandwidth:{
						upload:'---',
						download:'---'
					},
					price:'---',
					address:'---',
					operator:'---',
					peers:0
				}
			}
		}
		this.parentComponent.nodeStatus.setStatus(isConnected);
		$('.analyticsPanel').removeClass('loading');
		this.renderNodeAnalytics(node.result,balance,analytics,addressMeta,data.activeSessions,data.sessions);
		this.renderSessionsRealtime(data.activeSessions,data.sessions);
		this.streamGraph = new StreamGraph($('#streamgraph'));
		this.streamGraph.render(data.timeseries);

		let timeout;
		$(window).off('resize').on('resize',()=>{
			if(typeof timeout != "undefined"){
				clearTimeout(timeout);
			}
			timeout = setTimeout(()=>{
				this.streamGraph.resize();
				this.resizeDonuts();
				delete this.timeout;
			},80)
		})
	}
	renderNodeAnalytics(node,balance,analytics,addressMeta,sessionMeta,allSessionsMeta){
		console.log('node data',node);
		const bandwidth = node.bandwidth;
		const moniker = node.moniker;
		let price;
		if(node.offline){
			price = '---'
		}
		else{
			price = node.price.replace('udvpn',' udvpn');
		}


		const sessions = node.peers;
		const nodeAddress = node.address;
		const walletAddress = node.operator;
		if(typeof balance.available == "undefined"){
			balance = {
				available:{
					denom:'udvpn',
					amount:0
				}
			}
		}	
		let walletBalance = balance.available.amount + ' ' + balance.available.denom.toUpperCase();
		
		let balanceInDVPN = 0;
		if(balance.available.denom == 'udvpn'){
			//make dvpn
			walletBalance = Math.floor(balance.available.amount/10000) / 100 + ' DVPN';
			balanceInDVPN = Math.floor(balance.available.amount/10000) / 100
		}
		const $el = $('#nodeMeta');
		$el.html(`<div class="title">
			${moniker}
		</div>`)
		$('.monikerWrap',$el).off('click').on('click',()=>{
			if(node.offline){
				this.parentComponent.nodeConfig.hide();
				this.parentComponent.nodeStatus.show();
				this.parentComponent.hide();
			}
		})
		const $info = $('<div class="nodeInfo"></div>');

		$el.append(`
			<div class="walletQR"><img src="${addressMeta.qr}" /></div>
		`)
		$el.append($info);
		$info.append(`<div class="addr"><span>Node Address:</span> ${addressMeta.address}</div>`);
		$info.append(`<div class="balance"><span>Wallet Balance:</span> ${walletBalance}</div>`)

		$info.append(`
			<div class="bandwidth">
				<span>Download Speed:</span> ${numeral(node.bandwidth.download*8).format('0.00b').toUpperCase()}
				<span>Upload Speed:</span> ${numeral(node.bandwidth.upload*8).format('0.00b').toUpperCase()}
			</div>`)
		
		$info.append(`<div class="price"><span>Price (GB):</span> ${price.toUpperCase()}</div>`);
		$info.append(`<div class="sessions"><span>Connected Sessions:</span> ${sessions}</div>`);
		if(balanceInDVPN < 50){
			$info.append('<div class="balanceNote">Note: You will incur regular transaction fees while keeping your dvpn-node online. We recommend keeping at least 50 DVPN in your wallet for fees.</div>')
			
		}
		if(balanceInDVPN == 0){
			$('.balanceNote',$info).html(`
				Warning: You must have DVPN in your wallet to cover transaction fees. 
				<br />Please deposit at least 50DVPN in this wallet.
			`)
			$('#nodeStatusInfo .balanceNote').show()
		}
		else{
			$('#nodeStatusInfo .balanceNote').hide()
		}
		this.renderAnalyticsPanel(analytics,sessionMeta,allSessionsMeta,sessionMeta);
	}
	renderAnalyticsPanel(analytics,sessionMeta,allSessionsMeta,subscriberData){
		//console.log('analytics',analytics);
		let updatedAt = {};
		subscriberData.map(subscriber=>{
			
			const updatedMins = moment().diff(moment(subscriber.latestUpdated),'minutes');
			const humanizedUpdated = moment.duration(updatedMins,'minutes').humanize();
			const subID = subscriber.subscription;
			updatedAt[subID] = humanizedUpdated;
		})
		if(typeof analytics == "undefined"){
			analytics = {
				avgDuration:0,
				durationSum:0
			}
		}
		/*const avgDuration = Math.floor(analytics.avgDuration*100)/100;
		const sumDuration = Math.floor(analytics.durationSum*100)/100;*/
		let sessionCount = 0;//analytics.sessionCount;
		

		let totalBandwidthDown = 0;//analytics.totalBandwidthDOWN;
		let totalBandwidthUp = 0;//analytics.totalBandwidthUP;
		let totalRemaining = 0;
		/*sessionMeta.map(subscriber=>{
			//direction is from the subscriber perspective
			totalBandwidthDown += subscriber.nodeUP;
			totalBandwidthUp += subscriber.nodeDOWN;
		});*/
		let subscriptionCount = 0;//Object.keys(analytics.uniqueSubscriptions).length;
		const uniqueSubs = allSessionsMeta; //analytics.uniqueSubscriptions;

		Object.keys(allSessionsMeta).map(sid=>{
			const data = allSessionsMeta[sid];
			sessionCount += data.sessions;
			subscriptionCount += 1;
			totalBandwidthDown += data.totalDown;
			totalBandwidthUp += data.totalUp;
			totalRemaining += data.remaining;
		});
		if(totalRemaining < 0){
			totalRemaining = 0;
		}
		
		const $nodeAnalytics = $('#nodeAnalytics');
		$nodeAnalytics.html('<div class="sectionTitle">Session Analytics</div>')
		const $subscriptionAnalytics = $('#subscriptionAnalytics');
		/*const $durations = $(`
			<div class="durations">
				<div class="avg"><span>Average Session Duration:</span> ~${moment.duration(avgDuration,'minutes').humanize()}</div>
				<div class="total"><span>Sum Session Durations:</span> ~${moment.duration(sumDuration,'minutes').humanize()}</div>
			</div>
		`);*/
		const $sessions = $(`
			<div class="sessions">
				<div class="title">
					Analytics
				</div>
				<div class="subs"><span>Subscription Count:</span> ${subscriptionCount}</div>
				<div class="count"><span>Completed Sessions:</span> ${sessionCount}</div>
				<div class="totalDown"><span>Total Bandwidth Download:</span> ${numeral(totalBandwidthDown).format('0.00b').toUpperCase()}</div>
				<div class="totalUp"><span>Total Bandwidth Upload:</span> ${numeral(totalBandwidthUp).format('0.00b').toUpperCase()}</div>
				<div class="totalRemaining"><span>Total Contract Bandwidth Remaining:</span> ${numeral(totalRemaining).format('0.00b').toUpperCase()}</div>
			</div>
		`);
		const $subs = $(`
			<div class="subscriptions">
				<div class="sectionTitle">Subscribers</div>
				<ul />
			</div>
		`);
		let donuts = [];
		Object.keys(uniqueSubs).map(subKey=>{
			const sub = uniqueSubs[subKey];
			
			let seenAt = moment.duration(moment().diff(moment(sub.lastSeen,'X'),'minutes'),'minutes').humanize()
			if(typeof updatedAt[subKey] != "undefined"){
				seenAt = updatedAt[subKey];
			}
			let remaining = numeral(sub.remaining).format('0.00b').toUpperCase();
			if(sub.remaining < 0){
				remaining = '0.00B';
			}
			const $li = $(`
				<li>
					<div class="subscriberMetrics">
						<div class="id"><span>Subscription ID:</span> ${subKey}</div>
						<div class="sessions"><span>Sessions:</span> ${sub.sessions}</div>
						<div class="down"><span>Total Download:</span> ${numeral(sub.totalDown).format('0.00b').toUpperCase()}</div>
						<div class="down"><span>Total Upload:</span> ${numeral(sub.totalUp).format('0.00b').toUpperCase()}</div>
						<div class="down"><span>Total Remaining:</span> ${remaining}</div>
						<div class="down"><span>Last Seen:</span> ${seenAt} ago</div>
					</div>
					<div class="donut donutChart dvpnDonut">
						<div class="donutTitle">Contract</div>
						<svg />
					</div>
				</li>
			`)
			$('ul',$subs).append($li);
			const $donutEl = $('.donut',$li);
			
			const donut = new DonutChart($donutEl);
			let totalUsed = (sub.totalDown+sub.totalUp);
			if(totalUsed > sub.totalContract){
				totalUsed = sub.totalContract
			}
			const donutData = [
				{name:'Bandwidth Used',value: totalUsed, formatted: numeral(totalUsed).format('0.00b').toUpperCase()},
				{name:'Remaining',value:sub.totalContract, formatted: numeral(sub.remaining).format('0.00b').toUpperCase()}
			];

			donuts.push({
				$el:$li,
				donut,
				subscriberID:subKey,
				data:donutData,
				ogData: JSON.parse(JSON.stringify(donutData))
			})
		})
		
		

		//$nodeAnalytics.html($durations)
		$nodeAnalytics.html($sessions);
		$subscriptionAnalytics.html($subs);
		donuts.map(donutWidget=>{
			const $li = donutWidget.$el;
			const donut = donutWidget.donut;
			const donutData = donutWidget.data;
			const w = $('.donut',$li).width();
			console.log('donut w',w);
			$('.donut',$li).css('height',w); //sqaure it up
			
			donut.render(donutData);
		})
		this.donuts = donuts;
	}
	resizeDonuts(){
		const donuts = this.donuts;
		donuts.map(donutWidget=>{
			const $li = donutWidget.$el;
			const donut = donutWidget.donut;
			//const donutData = JSON.parse(JSON.stringify(donutWidget.data));
			const donutData = JSON.parse(JSON.stringify(donutWidget.ogData));
			const w = $('.donut',$li).width();
			console.log('donut w',w);
			$('.donut',$li).css('height',w); //sqaure it up
			donut.render(donutData);
		})
	}
	renderSessionsRealtime(data,sessions){
		const $el = $('#sessionMeta');
		$el.html('<div class="sectionTitle">Active Sessions</div>')
		if(data.length == 0){
			$el.append('<div class="nosessions">(no active sessions)</div>')
		}
		else{
			this.renderAnalyticsPanel(undefined,undefined,sessions,data);
			const $ul = $('<ul />');

			data.map(subscriber=>{
				const mins = moment().diff(moment(subscriber.latestCreated),'minutes');
				const humanizedCreated = moment.duration(mins,'minutes').humanize();
				
				const updatedMins = moment().diff(moment(subscriber.latestUpdated),'minutes');
				const humanizedUpdated = moment.duration(updatedMins,'minutes').humanize();
				let labelExtra = '';
				let sessionIDs = subscriber.sessionIDs.join(',')
				if(subscriber.sessionIDs.length > 1){
					labelExtra = 's';
				}
				let uploadVol = subscriber.nodeUP;
				let downloadVol = subscriber.nodeDOWN;
				let avail = subscriber.subscriptionAvail;
				let sessionID = subscriber.sessionIDs.slice(-1);
				if(typeof sessions[subscriber.subscription] != "undefined"){
					uploadVol = sessions[subscriber.subscription].totalUp;
					downloadVol = sessions[subscriber.subscription].totalDown;
					avail = sessions[subscriber.subscription].totalContract - (uploadVol + downloadVol);
					if(avail < 0){
						avail = 0;
					}
				}
				const $li = $(`
					<li>
						<div class="id"><span>Subscription ID:</span> ${subscriber.subscription}</div>
						<div class="remaining"><span>Remaining Quota:</span> ${numeral(avail).format('0.00b').toUpperCase()}</span></div>
						<div class="sessions"><span>Session ID:</span> ${sessionID}</div>
						<div class="down"><span>Client Download Volume:</span> ${numeral(uploadVol).format('0.00b').toUpperCase()}</div>
						<div class="down"><span>Client Upload Volume:</span> ${numeral(downloadVol).format('0.00b').toUpperCase()}</div>
						<div class="created"><span>Created: ${humanizedCreated} ago</span></div>
						<div class="created"><span>Updated: ${humanizedUpdated} ago</span></div>
					</li>
				`)
				$ul.append($li);
			});
			$el.append($ul);
		}
	}
}