import {DonutChart} from '../charts/DonutChart.js';

export class AKTClusterStatus{
	constructor(dashboardComponent){
		this.dashboard = dashboardComponent;
		fetch('./uiFragments/akt/clusterStatus.html').then(res=>res.text()).then(fragment=>{
			$('body').append(fragment);
			this.initDonuts();
		})
		this.fetchStats();
		
	}
	show(){
		$('#clusterStatus').show();
		this.fetchStats();

	}
	hide(){
		$('#clusterStatus').hide();
	}
	fetchStats(){
		fetch('/api/akt/getClusterStats').then(d=>d.json()).then(data=>{
			if(!data.providerIsRunning && data.providerIsRegistered && data.providerHasGeneratedCert){
				$('#aktMain .options li#providerStatus').show();
			}
			if(data.providerIsRunning){
				$('#aktMain .options li#providerStatus').hide();
				$('#aktMain .options li#providerLogs').show();
			}
			this.dashboard.aktStatus = data;
			this.dashboard.showUpdateOpts(data.akashVersion);
			this.renderStats(data);
		});
		fetch('/api/akt/getMarketAggregates').then(d=>d.json()).then(data=>{
			this.marketAggs = data;
			this.renderMarketAggregates(data);
		})
	}
	marketAggsUpdate(data){
		this.renderMarketAggregates(data);
	}
	realtimeUpdate(data){
		this.dashboard.aktStatus = data;
		this.renderStats(data);
	}
	renderStats(statsData){
		let clusterName = statsData.providerData.clusterName;
		let address = statsData.providerData.providerWalletAddress;
		if(typeof clusterName == "undefined"){
			clusterName = 'No Configuration Found'
		}
		if(typeof address == "undefined"){
			address = "No Configuration Found";
		}
		const regionName = statsData.providerData.regionName;
		const nodeCount = statsData.nodeCount;
		let onlineCount = 0;
		statsData.k8s.map(machine=>{
			if(Object.keys(machine.sections).length > 0){
				onlineCount++;
			}
		})
		const shouldShowProviderStatusIndicator = statsData.providerIsRegistered && statsData.providerHasGeneratedCert;
		
		this.renderBalance(statsData.balance,address,statsData.k8s);
		this.renderTitle(clusterName,onlineCount,nodeCount,statsData.providerIsRunning,shouldShowProviderStatusIndicator);
		this.renderResourceUsage(statsData.k8s);
		this.renderRunInfo(statsData);
		
	}
	renderMarketAggregates(data){
		const $el = $('.marketAggregatesInfo');
		let leasesClosed = data.leasesClosed || 0;
		/*if(typeof leasesClosed == "undefined"){
			leasesClosed = 0;
		}*/
		leasesClosed = leasesClosed >= 1000 ? numeral(leasesClosed).format('0.0a') : leasesClosed;
		let leasesActive = data.leasesActive || 0;
		leasesActive = leasesActive >= 1000 ? numeral(leasesActive).format('0.0a') : leasesActive;
		let bidsOpen = data.bidsOpen || 0;
		bidsOpen = bidsOpen >= 1000 ? numeral(bidsOpen).format('0.0a') : bidsOpen;
		let bidsClosed = data.bidsClosed || 0;
		bidsClosed = bidsClosed >= 1000 ? numeral(bidsClosed).format('0.0a') : bidsClosed;
		const $q0 = $(`
		<div class="quadrant">
			<div class="quadTitle">Leases Active</div>
			<div class="value">${leasesActive}</div>
		</div>`)
		const $q1 = $(`
		<div class="quadrant">
			<div class="quadTitle">Leases Closed</div>
			<div class="value">${leasesClosed}</div>
		</div>`)
		const $q2 = $(`
		<div class="quadrant">
			<div class="quadTitle">Bids Open</div>
			<div class="value">${bidsOpen}</div>
		</div>`)
		const $q3 = $(`
		<div class="quadrant">
			<div class="quadTitle">Bids Closed</div>
			<div class="value">${bidsClosed}</div>
		</div>`)
		$el.html('<div class="subtitle">Marketplace Stats</div>');
		$el.append($q0);
		$el.append($q1);
		$el.append($q2);
		$el.append($q3);
	}
	renderRunInfo(statsData){
		const $el = $('.runClusterInfo');
		$el.html('<div class="subtitle">Akash Provider Registration Status</div>');
		if(statsData.providerIsRegistered){
			//heyo we registered
			$el.append('<div class="isregistered"><span class="emoji">✅</span> Provider is Registered <a class="aktStatusPageLink" href="https://www.mintscan.io/akash/txs/'+statsData.providerReceiptTX+'" target="_blank">View Transaction in Explorer</a></div>')
			$el.append('<div class="updateRegistration"><a class="aktStatusPageLink">Update Registration?</a></div>')
		}
		else{
			//not yet registered..
			$el.append('<div class="noregistered"><span class="emoji">⚠️</span> No Registration Found for Your Address</div>')
			$el.append('<div class="createRegistration"><a class="aktStatusPageLink">Create Registration</a></div>')
		}
		if(statsData.providerHasGeneratedCert){
			$el.append('<div class="hasGeneratedCert"><span class="emoji">✅</span> Provider has Generated Akash Certificate</div>');
			$el.append('<div class="regenCertificate"><a class="aktStatusPageLink">Re-Generate Certificate?</a></div>')
		}
		else{
			$el.append('<div class="hasGeneratedCert"><span class="emoji">⚠️</span> No Akash Server Certificate Found for Your Address</div>');
			$el.append('<div class="regenCertificate"><a class="aktStatusPageLink">Generate Certificate</a></div>')
		}
		$('.updateRegistration a').off('click').on('click',()=>{
			//show pw modal and fetch updateRegistration
			this.showRegistrationModal(true,statsData.providerData.providerWalletName);
		})
		$('.createRegistration a').off('click').on('click',()=>{
			//show pw modal and fetch createRegistration
			this.showRegistrationModal(false,statsData.providerData.providerWalletName);
		});
		$('.regenCertificate a').off('click').on('click',()=>{
			this.showRegistrationModal(false,statsData.providerData.providerWalletName,true);
		})
	}
	renderResourceUsage(k8sData){
		let summary = this.modelResourceSum(k8sData);
		//console.log('summary',summary);
		
		const cpuUsed = (summary.Used.cpu/*summary.Allocatable.sumAllocatableCPUm*/);
		const cpuData = [
			{name:'Used',value: cpuUsed, formatted: cpuUsed+'m'},
			{name:'Total',value:summary.Capacity.sumCapacityCPUm, formatted: summary.Capacity.sumCapacityCPUm+'m'}
		];
		this.cpuDonut.render(cpuData);

		const memoryUsed = (summary.Capacity.sumCapacityMemory - summary.Allocatable.sumAllocatableMemory);
		const memoryData = [
			{name:'Used',value: memoryUsed, formatted: numeral(memoryUsed).format('0.00b').toUpperCase()},
			{name:'Total',value:summary.Capacity.sumCapacityMemory, formatted: numeral(summary.Capacity.sumCapacityMemory).format('0.00b').toUpperCase()}
		];
		this.memoryDonut.render(memoryData);

		const ephemeralUsed = (summary.Capacity.sumCapacityEphemeral - summary.Allocatable.sumAllocatableEphemeral);
		const ephemeralData = [
			{name:'Used',value: ephemeralUsed, formatted: numeral(ephemeralUsed).format('0.00b').toUpperCase()},
			{name:'Total',value:summary.Capacity.sumCapacityEphemeral, formatted: numeral(summary.Capacity.sumCapacityEphemeral).format('0.00b').toUpperCase()}
		];
		this.ephemeralDonut.render(ephemeralData);

		const podsUsed = summary.Used.pods;//(summary.Capacity.sumCapacityPods - summary.Allocatable.sumAllocatablePods);
		const podsData = [
			{name:'Used',value: podsUsed, formatted: podsUsed.toString()},
			{name:'Total',value:summary.Capacity.sumCapacityPods, formatted: summary.Capacity.sumCapacityPods.toString()}
		];
		console.log('eph',podsData)
		
		this.podsDonut.render(podsData);
		
		//now render table per node
		const $el = $('.nodesResourceUsage');
		$el.html('<div class="subtitle">Cluster Nodes Resource Utilization</div>')
		k8sData.map(node=>{
			console.log('render node',node);
			const name = node.name;
			/*const $table = $('<table></table>');
			$table.append('<tr><td>'+name+'</td></tr>')*/
			const $node = $('<div class="nodeDetail"></div>')
			$node.append('<div class="nodeTitle">'+name+'</div>')
			if(Object.keys(node.sections).length == 0){
				$node.append('<div class="nonConnected"><span class="emoji">⚠️</span> Node is Offline</div>')
			}
			Object.keys(node.sections).map(sectionKey=>{
				/*const $sectionTitle = $('<tr><td>'+sectionKey+'</td></tr>')
				const $header = $('<tr />');
				const $row = $('<tr />');*/
				const $sectionTitle = $('<li class="sectionTitle">'+sectionKey+'</li>')
				const $section = $('<ul />');
				$section.append($sectionTitle);
				const section = node.sections[sectionKey];
				if(sectionKey != 'Allocated resources'){
					Object.keys(section).map(key=>{
						/*$header.append('<th>'+key+'</th>')
						$row.append('<td>'+section[key]+'</td>')*/
						let val = section[key];
						if(val.indexOf('Ki') >= 0){
							val = numeral(val).multiply(1000).format('0.00b').toUpperCase()
						}
						if(key == 'ephemeral-storage' && sectionKey == 'Allocatable'){
							val = numeral(val).format('0.00b').toUpperCase();
						}
						if(key == 'pods' && sectionKey == 'Allocatable'){
							val = val - node.realtime.pods;
						}
						const $li = $('<li><span class="nodeLabel">'+key+'</span>: '+val+'</li>');
						$section.append($li);
					})
					$node.append($section);
					/*$table.append($sectionTitle);
					$table.append($header);
					$table.append($row);*/
				}
				else{
					//formatted differently, but leave out for now
				}
				
			})
			$el.append($node);
		})

		
	}
	modelResourceSum(k8sData){
		//let sumTotalCPUs = 0;
		let sumCapacityCPUm = 0;
		let sumCapacityEphemeral = 0;
		let sumCapacityMemory = 0;
		let sumCapacityPods = 0;

		//let sumAllocatedCPUs = 0;
		let sumAllocatedCPUmLimits = 0;
		let sumAllocatedEphemeralLimits = 0;
		let sumAllocatedMemoryLimits = 0;
		let sumAllocatedPodsLimits = 0;

		let sumAllocatedCPUmRequests = 0;
		let sumAllocatedEphemeralRequests = 0;
		let sumAllocatedMemoryRequests = 0;
		let sumAllocatedPodsRequests = 0;

		//let sumAllocatableCPUs = 0;
		let sumAllocatableCPUm = 0;
		let sumAllocatableEphemeral = 0;
		let sumAllocatableMemory = 0;
		let sumAllocatablePods = 0;

		let sumUsedCPUm = 0;
		let sumUsedMemory = 0;
		let sumUsedPods = 0;

		k8sData.map(node=>{
			//allocatable
			let section = node.sections['Allocatable'];
			if(typeof section == 'undefined'){
				return;
			}
			let mCPU = numeral(section.cpu).value() / 1000000; //ie 3900m
			let storage = numeral(section['ephemeral-storage']).value();
			let pods = parseInt(section.pods);
			let memory = numeral(section['memory']).value() * 1000;
			sumAllocatableCPUm += mCPU;
			sumAllocatablePods += pods;
			sumAllocatableEphemeral += storage;
			sumAllocatableMemory += memory;

			//allocated
			section = node.sections['Allocated resources'];
			
			section.map(res=>{
				//console.log('res',res);
				let requests = res.Requests.split(' (')[0];
				let limits = res.Limits.split(' (')[0];
				switch(res.Resource){
					case 'cpu':
						let mCPURequests = numeral(requests).value() / 1000000;
						let mCPULimit = numeral(limits).value() / 1000000;
						sumAllocatedCPUmRequests += mCPURequests;
						sumAllocatedCPUmLimits += mCPULimit;
					break;
					case 'memory':
						let memoryRequests = numeral(requests).value();
						let memoryLimit = numeral(limits).value();
						sumAllocatedMemoryRequests += memoryRequests;
						sumAllocatedMemoryLimits += memoryLimit;
					break;
					case 'ephemeral-storage':
						let storageRequests = numeral(requests).value();
						let storageLimits = numeral(limits).value();
						sumAllocatedEphemeralRequests += storageRequests;
						sumAllocatedEphemeralLimits += storageLimits;
					break;
				}
			});

			//capacity
			section = node.sections['Capacity'];
			sumCapacityCPUm += parseInt(section['cpu']) * 1000;
			sumCapacityEphemeral += numeral(section['ephemeral-storage']).value() * 1000;
			sumCapacityMemory += numeral(section['memory']).value() * 1000;
			sumCapacityPods += parseInt(section['pods']);

			//used
			const realtime = node.realtime;
			sumUsedCPUm += parseInt(realtime['cpu(cores)'].replace('m',''));
			let memVal = realtime['memory(bytes)'];
			if(memVal.indexOf('G') >= 0){
				//gb
				memVal = numeral(memVal).multiply(1000000000).value();
			}
			else if(memVal.indexOf('M') >= 0){
				//mb
				memVal = numeral(memVal).multiply(1000000).value();
			}
			
			sumUsedMemory += parseInt(memVal);
			sumUsedPods += realtime.pods;
		});

		return {
			Capacity:{
				sumCapacityCPUm,
				sumCapacityEphemeral,
				sumCapacityMemory,
				sumCapacityPods
			},
			Allocated:{
				requests:{
					sumAllocatedMemoryRequests,
					sumAllocatedEphemeralRequests,
					sumAllocatedCPUmRequests,
					sumAllocatedPodsRequests
				},
				limits:{
					sumAllocatedMemoryLimits,
					sumAllocatedEphemeralLimits,
					sumAllocatedCPUmLimits,
					sumAllocatedPodsLimits
				}
			},
			Allocatable:{
				sumAllocatableCPUm,
				sumAllocatableMemory,
				sumAllocatableEphemeral,
				sumAllocatablePods
			},
			Used:{
				cpu: sumUsedCPUm,
				memory: sumUsedMemory,
				pods: sumUsedPods
			}
		}

	}
	renderTitle(clusterName,onlineCount,nodeCount,isProviderRunning,shouldShowProviderStatusIndicator){
		const $el = $('#clusterStatus');
		const indicator = onlineCount / nodeCount == 1 ? 'online' : ( (nodeCount - onlineCount) == nodeCount ? 'offline' : 'issue' )
		const providerIndicator = isProviderRunning ? 'online' : 'offline';
		const providerStatusLabel = isProviderRunning ? 'Online' : 'Offline';
		$('.title',$el).html(clusterName)
		$('.title',$el).append(`
			<div class="nodeCounts">
				<span class="indicator ${indicator}"></span>
				Nodes Online: ${onlineCount}/${nodeCount}
			</div>
		`);
		if(shouldShowProviderStatusIndicator){
			$('.title',$el).append(`
				<div class="providerStat">
					<span class="indicator ${providerIndicator}"></span>
					Provider is ${providerStatusLabel}
				</div>
			`);
			if(!isProviderRunning){
				$('.providerStat').addClass('offlineStatus');
				$('.providerStat').off('click').on('click',()=>{
					this.dashboard.showRunProviderModal();
				})
			}
			
		}
	}
	renderBalance(balanceData,address,k8sData){
		const $el = $('#clusterStatus');
		let balance = 0;
		let lockedBalance = 0;
		let denom = 'uakt';
		if(balanceData.balance.balances.length > 0){
			balanceData.balance.balances.map(v=>{
				balance += parseInt(v.amount);
				denom = v.denom;
			});
		}
		if(denom == 'uakt'){
			balance = balance / 1000000;
		}
		
		//no easy way to lookup so:: 50akt per contract * pods = locked.....
		k8sData.map(node=>{
			lockedBalance += (node.realtime.pods * 50);
		});
		let shouldDisplayLowFundsMessage = false;
		if(balance < 50){
			shouldDisplayLowFundsMessage = true;
		}
		balance =  numeral(balance).format('0,0.0000')+' AKT';

		let qr = balanceData.qr;
		const $balance = $('.accountBalance',$el);
		let img;
		if(typeof qr != "undefined"){
			img = `<img src="${qr}" />`;
		}
		else{
			img = '';
		}
		$balance.html(`
			<div class="qrWrap">
				${img}
			</div>
			<div class="balanceMeta">
				<div class="address">Address: <input type="text" readonly class="walletAddress" value="${address}" size="46" /></div>
				<div class="balance">${balance}</div>

			</div>
		`)
		if(shouldDisplayLowFundsMessage){
			$('.balanceMeta',$balance).append('<div class="lowFundsNote">Note: Each contract will lock up 50AKT in collateral. Please add more funds to provide hosts.</div>')
		}

		if(lockedBalance > 0){
			$('.balance',$balance).append('<div class="locked">Locked Collateral: '+lockedBalance+' AKT</div>')
		}
		$('.walletAddress',$balance).off('click').on('click',()=>{
			$('.walletAddress',$balance).select();
		})
	}
	initDonuts(){
		this.$donutsEl = $('.clusterResourceStats .donuts');
		const w = $('.donutChart.cpu').width();
		$('.donutChart',this.$donutsEl).css('height',w); //sqaure it up
		this.cpuDonut = new DonutChart($('.donutChart.cpu',this.$donutsEl));
		this.memoryDonut = new DonutChart($('.donutChart.memory',this.$donutsEl));
		this.ephemeralDonut = new DonutChart($('.donutChart.ephemeral',this.$donutsEl));
		this.podsDonut = new DonutChart($('.donutChart.pods',this.$donutsEl));

	}
	hideModal(){
		$('.walletModalContent').removeClass('showing');
		$('#registrationModal').hide();
		$('#unlockRegPW').val('');
		$( "#generateCert" ).prop('checked', false );
		$('.registerProviderModal .checkboxWrap').show();
		$('.walletUtil').addClass('showing');
	}
	showRegistrationModal(isUpdateMode,walletName,isGenerateCertOnly){
		$('#closeModal').off('click').on('click',()=>{
			this.hideModal();
		})
		const label = isGenerateCertOnly ? 'Generate Certificate' : 'Register';
		$('#registerSave .foreground').html(label);
		$('#registerSave .background').html(label);
		$('#registrationModal').show();
		$('.walletModalContent').removeClass('showing');
		$('.registerProviderModal').addClass('showing');
		if(isGenerateCertOnly){
			$('#generateCert').prop('checked',true);
			$('.registerProviderModal .checkboxWrap').hide()
		}
		$('#registerSave').off('click').on('click',()=>{
			$('#registerSave .foreground').html('Submitting Tx...');
			$('#registerSave .background').html('Submitting Tx...');
			let endpoint = isUpdateMode ? 'updateProviderRegistration' : 'createProviderRegistration'
			if(isGenerateCertOnly){
				endpoint = 'generateServerCert';
			}
			const generateCert = $('#generateCert').is(':checked');
			let fees = $('#regFees').val();
			if(fees == ''){
				fees = '10000';
			}
			const registrationData = {
				pw:$('#unlockRegPW').val(),
				walletName,
				generateCert,
				fees
			};
			fetch("/api/akt/"+endpoint,
			{
			    headers: {
			      'Accept': 'application/json',
			      'Content-Type': 'application/json'
			    },
			    method: "POST",
			    body: JSON.stringify(registrationData)
			})
			.then((res)=>{ console.log('success'); return res.json(); }).then(data=>{
				console.log('res data',data);
				if(data.error){
					this.showErrorModal(data.message);
				}
				else{
					this.verifyRegistration(data.message);
				}
				$('#registerSave .foreground').html(label);
				$('#registerSave .background').html(label);
			
			})
			.catch((res)=>{ console.log('error submitting',res) });
		})
		$('#cancelRegister').off('click').on('click',()=>{
			this.hideModal();
		})
		
	}
	showErrorModal(message){
		$('.registrationMessage .error').html('ERROR: '+message);
		$('.registrationMessage .error').show();
		$('.registrationMessage .success').hide();
		$('.registerProviderModal').removeClass('showing');
		$('.registrationMessage').addClass('showing');
		this.handleVerifyModalHide(true);
	}
	verifyRegistration(message){
		console.log('verify data',message);
		//$('.messageText').html('a wallet aaddress')
		$('.registrationMessage .success .messageText').html(message);
		
		$('.registrationMessage .error').hide();
		$('.registrationMessage .success').show();
		$('.registerProviderModal').removeClass('showing');
		$('.registrationMessage').addClass('showing');
		/*fetch('/api/sia/getWalletInfo').then(d=>d.json()).then(data=>{
			const isRescanning = data.rescanning;
			console.log('is wallet rescanning??',isRescanning);
			if(isRescanning){
				$('.walletUtil').removeClass('showing');
				$('.seedImportMessage').addClass('showing');
			}
		}).catch(error=>{
			//show some error message because the import didnt work...
			console.log('error doing seed import',error);
		});*/
		this.handleVerifyModalHide();

	}
	handleVerifyModalHide(wasError){
		$('#registrationMessageConf').off('click').on('click',()=>{
			this.hideModal()
			if(wasError){
				//this.showRegistrationModal();
				//leave it hidden
			}
			else{
				this.fetchStats();
			}
		})
	}

}