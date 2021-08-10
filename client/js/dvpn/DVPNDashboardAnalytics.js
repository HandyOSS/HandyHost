export class DVPNDashboardAnalytics{
	constructor(){
		/*
		<div class="dashboard">
			<div id="nodeMeta">
				Node metadata
			</div>
			<div id="sessionMeta">
				Session Meta
			</div>
			<div id="txMeta">
				TX Meta
			</div>
		</div>
		*/
	}
	renderAnalytics(data){
		const analytics = data.analytics;
		const balance = data.balance;
		const addressMeta = data.wallet;
		let node = data.node;
		console.log('data IN',data);
		if(Object.keys(data.node).length == 0){
			node = {
				result:{
					moniker: '<span class="warningEmoji">⚠️</span> Node Offline',
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
		$('.analyticsPanel').removeClass('loading');
		this.renderNodeAnalytics(node.result,balance,analytics,addressMeta);
		this.renderSessionsRealtime(data.activeSessions);
	}
	renderNodeAnalytics(node,balance,analytics,addressMeta){
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
		let walletBalance = balance.available.amount + ' ' + balance.available.denom.toUpperCase();
		if(balance.available.denom == 'udvpn'){
			//make dvpn
			walletBalance = Math.floor(balance.available.amount/10000) / 100 + ' DVPN';
		}
		const $el = $('#nodeMeta');
		$el.html(`<div class="title">
			${moniker}
		</div>`)
		const $info = $('<div class="nodeInfo"></div>');

		$el.append(`
			<div class="walletQR"><img src="${addressMeta.qr}" /></div>
		`)
		$el.append($info);
		$info.append(`<div class="addr"><span>Node Address:</span> ${addressMeta.address}</div>`);
		$info.append(`<div class="balance"><span>Wallet Balance:</span> ${walletBalance}</div>`)
		$info.append(`
			<div class="bandwidth">
				<span>Download Speed:</span> ${numeral(node.bandwidth.download).format('0.00b').toUpperCase()}
				<span>Upload Speed:</span> ${numeral(node.bandwidth.upload).format('0.00b').toUpperCase()}
			</div>`)
		
		$info.append(`<div class="price"><span>Price (GB):</span> ${price.toUpperCase()}</div>`);
		$info.append(`<div class="sessions"><span>Connected Sessions:</span> ${sessions}</div>`);
		
		this.renderAnalyticsPanel(analytics);
	}
	renderAnalyticsPanel(analytics){
		//console.log('analytics',analytics);
		const avgDuration = Math.floor(analytics.avgDuration*100)/100;
		const sumDuration = Math.floor(analytics.durationSum*100)/100;
		const sessionCount = analytics.sessionCount;
		const totalBandwidthDown = analytics.totalBandwidthDOWN;
		const totalBandwidthUp = analytics.totalBandwidthUP;
		const subscriptionCount = Object.keys(analytics.uniqueSubscriptions).length;
		const uniqueSubs = analytics.uniqueSubscriptions;
		const $nodeAnalytics = $('#nodeAnalytics');
		$nodeAnalytics.html('<div class="sectionTitle">Session Analytics</div>')
		const $subscriptionAnalytics = $('#subscriptionAnalytics');
		const $durations = $(`
			<div class="durations">
				<div class="avg"><span>Average Session Duration:</span> ~${moment.duration(avgDuration,'minutes').humanize()}</div>
				<div class="total"><span>Sum Session Durations:</span> ~${moment.duration(sumDuration,'minutes').humanize()}</div>
			</div>
		`);
		const $sessions = $(`
			<div class="sessions">
				<div class="subs"><span>Subscription Count:</span> ${subscriptionCount}</div>
				<div class="count"><span>Completed Sessions:</span> ${sessionCount}</div>
				<div class="totalDown"><span>Total Bandwidth Download:</span> ${numeral(totalBandwidthDown).format('0.00b').toUpperCase()}</div>
				<div class="totalUp"><span>Total Bandwidth Upload:</span> ${numeral(totalBandwidthUp).format('0.00b').toUpperCase()}</div>
			</div>
		`);
		const $subs = $(`
			<div class="subscriptions">
				<div class="sectionTitle">Subscribers</div>
				<ul />
			</div>
		`);
		Object.keys(uniqueSubs).map(subKey=>{
			const sub = uniqueSubs[subKey];
			const $li = $(`
				<li>
					<div class="id"><span>Subscription ID:</span> ${sub.id.split('_')[0]}</div>
					<div class="address"><span>Address:</span> ${sub.address}</div>
					<div class="sessions"><span>Sessions:</span> ${sub.sessionCount}</div>
					<div class="mins"><span>Total Time:</span> ~${moment.duration(sub.durationSum,'minutes').humanize()}</div>
					<div class="down"><span>Total Download:</span> ${numeral(sub.totalBandwidthDOWN).format('0.00b').toUpperCase()}</div>
					<div class="down"><span>Total Upload:</span> ${numeral(sub.totalBandwidthUP).format('0.00b').toUpperCase()}</div>
				</li>
			`)
			$('ul',$subs).append($li);
		})
		$nodeAnalytics.html($durations)
		$nodeAnalytics.html($sessions);
		$subscriptionAnalytics.html($subs);
	}
	renderSessionsRealtime(data){
		const $el = $('#sessionMeta');
		$el.html('<div class="sectionTitle">Active Sessions</div>')
		if(data.length == 0){
			$el.append('<div class="nosessions">(no active sessions)</div>')
		}
		else{
			const $ul = $('<ul />')
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
				const $li = $(`
					<li>
						<div class="id"><span>Subscription ID:</span> ${subscriber.subscription}</div>
						<div class="remaining"><span>Remaining Quota:</span> ${numeral(subscriber.subscriptionAvail).format('0.00b').toUpperCase()}</span></div>
						<div class="sessions"><span>Session ID${labelExtra}:</span> ${sessionIDs}</div>
						<div class="down"><span>Client Download Volume:</span> ${numeral(subscriber.nodeUP).format('0.00b').toUpperCase()}</div>
						<div class="down"><span>Client Upload Volume:</span> ${numeral(subscriber.nodeDOWN).format('0.00b').toUpperCase()}</div>
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