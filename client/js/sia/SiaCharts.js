import {RadarChart} from './charts/RadarChart.js';
import {BeeSwarm} from './charts/BeeSwarm.js';
import {hastingsPerSiacoin,siacoinsToHastings,hastingsToSiacoins} from './siaUtils.js';
import {DonutChart} from '../charts/DonutChart.js';

export class HostScoreRadarChart{
	constructor($el){
		this.$el = $el;
		
	}
	render(data){
		console.log('render charts',data);
		const $chartEl = $('<div class="radarChart" id="hostScoreChart"><svg /></div>');
		$('.hostRadars',this.$el).html($chartEl);
		this.chart = new RadarChart($chartEl,"hostScoreChart",data,$('.hostRadars',this.$el));	
		this.renderText(data)

	}
	resize(){
		this.chart.render();
	}
	renderText(data){
		const $ul = $('<ul />');
		const colors = d3.schemeCategory10;
		data.regionalScores.map((reg,i)=>{
			const name = reg.region;
			let latency = reg.latency;
			latency = latency == null ? 'unknown' : latency+'ms';
			const up = reg.up;
			const down = reg.down;
			const score = reg.finalScore;
			const $li = $('<li class="scoreParam" />')
			$li.css('border-left','5px solid '+colors[i])
			
			$li.append('<div class="regionTitle">'+name+'</div>')
			$li.append('<div class="latency">Latency (contract formation): '+latency+'</div>')
			$li.append('<div class="up">Renter Upload: '+up+'MB</div>')
			$li.append('<div class="down">Renter Download: '+down+'MB</div>')
			$li.append('<div class="finalscore">Region Score: '+score+'</div>');
			$ul.append($li);
			$li.off('mouseenter').on('mouseenter',()=>{
				$li.addClass('hovered');
				$('.radarChart',this.$el).addClass('hovered');
				$('.radarChart .radarWrapper',this.$el).eq(i).addClass('active');
			})
			$li.off('mouseleave').on('mouseleave',()=>{
				$('li',$ul).removeClass('hovered');
				$('.radarChart',this.$el).removeClass('hovered');
				$('.radarChart .radarWrapper',this.$el).removeClass('active');
			})
		});
		$('.hostScoreValue',this.$el).html('Host Score: '+data.benchmarks.finalScore+'/10');
		$('.scoreInfo',this.$el).html($ul);

	}
	updateHostStats(){
		fetch('/api/sia/getHostPublicKey').then(d=>d.text()).then(res=>{
			const key = res.replace(/\"/g,'');
			fetch('https://siastats.info:3510/hosts-api/get_id/ed25519:'+key).then(d=>d.json()).then(hostID=>{
				if(hostID.status == 'ok'){
					//everything is good
					let id = hostID.id;
					fetch('https://siastats.info:3510/hosts-api/host/'+id).then(d=>d.json()).then(result=>{
						console.log('host result',result);
						this.render(result);
					})
				}
				else{
					//TODO: notify/warnings
				}
			})
		}).catch(e=>{
			console.log('error',e);
		})
	}
}

export class ContractsChart{
	constructor($el){
		this.$el = $el;
		this.chart = new BeeSwarm($('.contractsBeeswarm',this.$el));
	}
	showContractsData(){
		fetch('/api/sia/getContracts').then(d=>d.json()).then(data=>{
			console.log('contracts',data);
			this.renderData(data);
			this.renderBeeswarm(data);
		})
	}
	renderData(data){
		let lockedCollateralSum = 0;
		let returnedCollateralSum = 0;
		let storageSum = 0;
		let uploadSum = 0;
		let downloadSum = 0;
		let proofOutputSum = 0;
		let activeContracts = 0;
		let completedContracts = 0;
		let completedRevenue = 0;
		let potentialAccountFunding = 0;
		let completedStorageSize = 0;
		data.contracts.map(contract=>{
			
				let collateral = contract.lockedcollateral;
				let negotationHeight = contract.negotiationheight;
				let proofDeadlineHeight = contract.proofdeadline;
				let riskedCollateral = contract.riskedcollateral;
				let txid = contract.transactionid;

				let validProofOutputRenter = contract.validproofoutputs[0].value;
				
				let validProofOutputHost = contract.validproofoutputs[1].value;
				proofOutputSum += hastingsToSiacoins(validProofOutputHost).toNumber();

				let storageRev = contract.potentialstoragerevenue;
				storageSum += hastingsToSiacoins(storageRev).toNumber();

				let uploadRev = contract.potentialuploadrevenue;
				uploadSum += hastingsToSiacoins(uploadRev).toNumber();

				let downloadRev = contract.potentialdownloadrevenue;
				downloadSum += hastingsToSiacoins(downloadRev).toNumber();
				let potentialFunding = contract.potentialaccountfunding;
				potentialAccountFunding += hastingsToSiacoins(potentialFunding).toNumber();

				let datasize = contract.datasize;

			if(contract.obligationstatus == "obligationUnresolved"){
				activeContracts += 1;
				lockedCollateralSum += hastingsToSiacoins(collateral).toNumber();
				
			}
			else{
				completedContracts += 1;
				if(contract.obligationstatus == "obligationSucceeded"/* && contract.proofconfirmed*/){
					
					completedRevenue += (hastingsToSiacoins(validProofOutputHost).toNumber());// - hastingsToSiacoins(contract.riskedcollateral).toNumber());
					returnedCollateralSum += hastingsToSiacoins(collateral).toNumber();
				}
				completedStorageSize += contract.datasize;
			}

		});
		let potentialIN = storageSum + uploadSum + downloadSum;
		potentialIN += (proofOutputSum - lockedCollateralSum);
		
		const $ul = $('<ul />');
		$ul.append('<li><span class="label">Active Contracts</span>: '+activeContracts+'</li>')
		//$ul.append('<li>Potential Revenue:'+Math.round(potentialIN*100)/100+'SC</li>');
		$ul.append('<li><span class="label">Locked Collateral</span>: '+Math.round(lockedCollateralSum*100)/100+'SC</li>');
		//$ul.append('<li>Storage Potential Revenue: '+Math.round(storageSum*100)/100+'SC</li>');
		//$ul.append('<li>Upload Potential Revenue: '+Math.round(uploadSum*100)/100+'SC</li>');
		//$ul.append('<li>Download Potential Revenue: '+Math.round(downloadSum*100)/100+'SC</li>');
		$ul.append('<li><span class="label">Completed Contracts</span>: '+completedContracts+'</li>');
		//$ul.append('<li>Completed Contract Revenue: '+Math.round(completedRevenue*100)/100+'SC</li>')
		$ul.append('<li><span class="label">Completed Storage Size</span>: '+numeral(completedStorageSize).format('0.00b').toUpperCase()+'</li>')
		$ul.append('<li><span class="label">Returned Collateral</span>: '+Math.round(returnedCollateralSum*100)/100+'SC</li>')
		
		$('.contractsMeta',this.$el).html($ul);
		//this.$el.height($('.contractsMeta',this.$el).height()+$('.valueLabel',this.$el).height()+20)
	}
	renderBeeswarm(data){
		fetch('/api/sia/getChainStatus').then(d=>d.json()).then(chainD=>{
			const height = chainD.height;
			const filtered = data.contracts.filter(d=>{
				return d.expirationheight >= height;
				//return !d.proofconfirmed;
			});
			this.data = filtered;
			this.height = height;
			this.chart.render(filtered,height);
		})
		
		//'.contractsChart';
	}
	resize(){
		//this.$el.height($('.contractsMeta',this.$el).height()+$('.valueLabel',this.$el).height()+20)
		this.chart.render(this.data,this.height);
	}
}

export class EarningsStorageChart{
	constructor($earningsContainer,$storageContainer){
		this.$earningsEl = $earningsContainer;
		this.$storageEl = $storageContainer;
		this.storageDonut = new DonutChart($('.donutChart.storageUsed',this.$storageEl));
		this.registryDonut = new DonutChart($('.donutChart.registryUsed',this.$storageEl));
	}
	fetchData(){
		fetch('/api/sia/getHostMetrics').then(d=>d.json()).then(data=>{
			console.log('data',data);
			this.rawData = data;
			this.renderEarningsPanel(data);
			this.renderStoragePanel(data);
		})
	}
	renderEarningsPanel(data){
		$('.earningsMeta',this.$earningsEl).html('');
		let props = {
			Income:{
				'contractcompensation':'Contract Compensation',
				'storagerevenue':'Storage Revenue',
				'downloadbandwidthrevenue':'Download Bandwidth Revenue',
				'transactionfeeexpenses':'Transaction Fee Expenses',
				'uploadbandwidthrevenue':'Upload Bandwidth Revenue',
				'accountfunding':'Account Funding'
			},
			Potential:{
				'potentialaccountfunding':'Potential Account Funding',
				'potentialcontractcompensation':'Potential Contract Compensation',
				'potentialdownloadbandwidthrevenue':'Potential Download Bandwidth Revenue',
				'potentialstoragerevenue':'Potential Storage Revenue',
				'potentialuploadbandwidthrevenue':'Potential Upload Bandwidth Revenue',
				'riskedstoragecollateral':'Risked Storage Collateral'
			},
			Lost:{
				'lostrevenue':'Lost Revenue',
				'loststoragecollateral':'Lost Storage Collateral'
			}
		};
		Object.keys(props).map(sectionName=>{
			const sectionKeys = props[sectionName];
			const $ul = $('<ul />');
			$ul.append('<div class="title">'+sectionName+'</div>')
			Object.keys(sectionKeys).map(key=>{
				const label = sectionKeys[key];
				const val = hastingsToSiacoins(data.financialmetrics[key]).toNumber();
				const $li = $(`<li><span class="label">${label}</span>: ${Math.floor(val*100)/100} SC</li>`);
				$ul.append($li);
			})
			$('.earningsMeta',this.$earningsEl).append($ul);
		})
		
	}
	renderStoragePanel(data){
		const registryTotal = data.registryentriestotal;
		const registryUsed = data.registryentriestotal - data.registryentriesleft;
		let storageTotal = 0;
		let storageUsed = 0;
		data.storagemetrics.folders.map(d=>{
			storageTotal += d.capacity;
			storageUsed += (d.capacity - d.capacityremaining)
		});

		const storageData = [
			{name:'Used',value:storageUsed, formatted: numeral(storageUsed).format('0.000b').toUpperCase()},
			{name:'Total',value:storageTotal, formatted: numeral(storageTotal).format('0.000b').toUpperCase()}
		];
		this.storageData = storageData;
		this.storageDonut.render(storageData);
		const regUsedFormatted = registryUsed < 1000 ? registryUsed.toString() : numeral(registryUsed).format('0.000a').toUpperCase();
		const regTotalFormatted = registryTotal < 1000 ? registryTotal.toString() : numeral(registryTotal).format('0.000a').toUpperCase();
		const registryData = [
			{name:'Used',value:registryUsed,formatted:regUsedFormatted},
			{name:'Total',value:registryTotal,formatted:regTotalFormatted}
		];
		this.registryData = registryData;
		this.registryDonut.render(registryData);

	}
	resize(){
		/*this.registryDonut.render(JSON.parse(JSON.stringify(this.registryData)));
		this.storageDonut.render(JSON.parse(JSON.stringify(this.storageData)));*/
		this.renderStoragePanel(this.rawData);
	}
}