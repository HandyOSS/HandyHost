import BigNumber from '../../external/bignumber.mjs';
import {hastingsPerSiacoin,siacoinsToHastings,hastingsToSiacoins} from './siaUtils.js';

export class SiaHostConfig {
	constructor(){
		BigNumber.config({ EXPONENTIAL_AT: 1e+9 })
		BigNumber.config({ DECIMAL_PLACES: 30 })
		
		fetch('./uiFragments/sia/hostInfo.html').then(res=>res.text()).then(fragment=>{
			$('body').append(fragment);
			this.getData();
		});
	}
	getData(){
		return new Promise((resolve,reject)=>{
			this.getConfig().then(configData=>{
				this.getPorts().then(portsData=>{
					this.getAveragePricing().then(pricingData=>{
						this.initHostForm(configData,pricingData,portsData);
						/*if(typeof configData.internalsettings['netaddress'] != "undefined"){
							//check config netaddress for blank
							if(configData.internalsettings['netaddress'] == ''){
								//get global ip
								fetch('https://www.myexternalip.com/json').then(d=>d.json()).then(data=>{
									configData.internalsettings['netaddress'] = data.ip;
									resolve();
								})
							}
							else{
								resolve();
							}
						}
						else{
							resolve();
						}*/
						resolve();
						
					});
				})
				
			});
		})
		
	}
	show(){
		this.getData();
		$('#siaHostInfo').show();
		
	}
	hide(){
		$('#siaHostInfo').hide();
	}
	
	initHostForm(configData,averagePriceData,portsData){
		console.log('config data',configData,averagePriceData,portsData);
		const fields = {
			acceptingcontracts:{type: 'boolean', field_type:'all', label:'Accepting Contracts', 'info':'When set to true, the host will accept new file contracts if the terms are reasonable. When set to false, the host will not accept new file contracts at all.'},
			maxdownloadbatchsize:{type:'bytes', field_type:'advanced', label:'Max Download Batch Size (MB)', 'info':'The maximum size of a single download request from a renter. Each download request has multiple round trips of communication that exchange money. Larger batch sizes mean fewer round trips, but more financial risk for the host - the renter can get a free batch when downloading by refusing to provide a signature.'},
			maxduration:{type:'blocks', field_type:'all', label:'Max Duration (days)', 'info':'The maximum duration of a file contract that the host will accept. The storage proof window must end before the current height + maxduration.'},
			maxrevisebatchsize:{type: 'bytes', field_type:'advanced', label: 'Max Revise Batch Size (MB)', 'info':'The maximum size of a single batch of file contract revisions. The renter can perform DoS attacks on the host by uploading a batch of data then refusing to provide a signature to pay for the data. The host can reduce this exposure by limiting the batch size. Larger batch sizes allow for higher throughput as there is significant communication overhead associated with performing a batch upload.'},
			netaddress: {type:'string', field_type:'all', label: 'Network Address', info: 'The IP address or hostname (including port) that the host should be contacted at. If left blank, the host will automatically figure out its ip address and use that. If given, the host will use the address given. If you dont want to use your IP: An easy/free domain name service to use is noip.com'},
			windowsize: {type: 'blocks', field_type:'advanced', label:'Window Size (days)', info: 'The storage proof window is the number of blocks that the host has to get a storage proof onto the blockchain. The window size is the minimum size of window that the host will accept in a file contract.'},
			collateral: {type: 'hastings/byte/block', field_type:'all', label: 'Collateral (SC/TB/Month)', info: 'The maximum amount of SC that the host will put up as collateral per TB/Month. It is generally recommended to put up 2x the Storage Price per TB/Month'},
			collateralbudget: {type: 'hastings', field_type:'all', label: 'Collateral Budget (SC)', info:'The total amount of money that the host will allocate to collateral across all file contracts.'},
			maxcollateral:{type:'hastings', field_type:'advanced', label: 'Max Collateral (SC)', info:'The maximum amount of collateral that the host will put into a single file contract.'},
			minbaserpcprice: {type: 'hastings', field_type:'advanced', label: 'Min Base RPC Price (SC)', info:'The minimum price that the host will demand from a renter for interacting with the host. This is charged for every interaction a renter has with a host to pay for resources consumed during the interaction. It is added to the mindownloadbandwidthprice and minuploadbandwidthprice when uploading or downloading files from the host.'},
			mincontractprice: {type: 'hastings', field_type:'advanced', label: 'Min Contract Price (SC)', info:'The minimum price that the host will demand from a renter when forming a contract. Typically this price is to cover transaction fees on the file contract revision and storage proof, but can also be used if the host has a low amount of collateral. The price is a minimum because the host may automatically adjust the price upwards in times of high demand.'},
			minsectoraccessprice: {type: 'hastings', field_type:'advanced', label: 'Min Sector Access Price (SC)', info: 'The minimum price that the host will demand from a renter for accessing a sector of data on disk. Since the host has to read at least a full 4MB sector from disk regardless of how much the renter intends to download this is charged to pay for the physical disk resources the host uses. It is multiplied by the number of sectors read then added to the mindownloadbandwidthprice when downloading a file.'},
			mindownloadbandwidthprice:{type: 'hastings/byte', label: 'Min Download Bandwidth Price (SC/TB)', info:'The minimum price that the host will demand from a renter when the renter is downloading data. If the host is saturated, the host may increase the price from the minimum.'},
			minstorageprice: {type:'hastings/byte/block', field_type:'all', label:'Min Storage Price (SC/TB/Month)', info:'The minimum price that the host will demand when storing data for extended periods of time. If the host is low on space, the price of storage may be set higher than the minimum.'},
			minuploadbandwidthprice: {type: 'hastings/byte', field_type:'all', label: 'Min Upload Bandwidth Price (SC/TB)', info:'The minimum price that the host will demand from a renter when the renter is uploading data. If the host is saturated, the host may increase the price from the minimum.'},
			maxephemeralaccountbalance: {type: 'hastings', field_type:'advanced', label:'Max Ephemeral Account Balance (SC)', info:'The maximum amount of money that the host will allow a user to deposit into a single ephemeral account.'},
			maxephemeralaccountrisk: {type: 'hastings', field_type:'advanced', label: 'Max Ephemeral Account Risk (SC)', info:`To increase performance, the host will allow a user to withdraw from an ephemeral account without requiring the user to wait until the host has persisted the updated ephemeral account balance to complete a transaction. This means that the user can perform actions such as downloads with significantly less latency. This also means that if the host loses power at that exact moment, the host will forget that the user has spent money and the user will be able to spend that money again.<br />maxephemeralaccountrisk is the maximum amount of money that the host is willing to risk to a system failure. The account manager will keep track of the total amount of money that has been withdrawn, but has not yet been persisted to disk. If a user's withdrawal would put the host over the maxephemeralaccountrisk, the host will wait to complete the user's transaction until it has persisted the widthdrawal, to prevent the host from having too much money at risk.<br />Note that money is only at risk if the host experiences an unclean shutdown while in the middle of a transaction with a user, and generally the amount at risk will be minuscule unless the host experiences an unclean shutdown while in the middle of many transactions with many users at once. This value should be larger than 'maxephemeralaccountbalance but does not need to be significantly larger.`},
			registrysize:{type: 'int', field_type:'all', label: 'Registry Size (GB)', info:'The size of the SkyNet registry in GigaBytes. We recommend 5-10GB of Registry Space.'},
			customregistrypath:{type:'string', field_type:'advanced', label:'Custom Registry Path', info:'The path of the registry on disk. If it&#039;s empty, it uses the default location relative to siad&#039;s host folder. Otherwise the provided path will be used. Changing it will trigger a registry migration which takes an arbitrary amount of time depending on the size of the registry.'}
		};
		const $el = $('#siaHostInfo');
		const $ul = $('<ul />')
		//$ul.append('<div class="hostTitle"><img src="./img/SiacoinSCLogo.svg" />Sia Host Settings</div>')
		$ul.append('<div class="hostTitle">Host Settings</div>')
		Object.keys(fields).map(fieldName=>{
			const labelData = fields[fieldName];
			let value;
			let avgValue;
			let hasAverageValue = false;
			if(typeof configData.internalsettings[fieldName] != "undefined"){
				value = configData.internalsettings[fieldName];
			}
			if(value == '' && typeof configData.externalsettings[fieldName] != "undefined"){
				value = configData.externalsettings[fieldName]
			}
			fields[fieldName]._ogVal = value;
			if(labelData.type.indexOf('hastings') >= 0){
				//convert to hastings
				value = hastingsToSiacoins(value);
			}
			if(fieldName == 'mindownloadbandwidthprice' || fieldName == 'minuploadbandwidthprice' || fieldName == 'collateral' || fieldName == 'minstorageprice'){
				//SC/TB
				value = new BigNumber(value).times(1e+6).times(1e+6).toString();
			}
			if(fieldName == 'collateral' || fieldName == 'minstorageprice'){
				//SC/TB/Month
				value = new BigNumber(value).times(144 * 28).toString();
			}
			if(labelData.type == 'bytes'){
				//set to MB
				value = new BigNumber(value).dividedBy(1e+6).toString();
			}
			if(labelData.type == 'blocks'){
				//convert to days
				value = new BigNumber(value).dividedBy(144).toString();
			}
			if(['collateral','minstorageprice','minuploadbandwidthprice','mindownloadbandwidthprice','maxduration'].indexOf(fieldName) >= 0){
				let valMap = {
					collateral:'collateral',
					minstorageprice:'storageprice',
					minuploadbandwidthprice:'upload',
					mindownloadbandwidthprice:'download',
					maxduration:'medianduration'
				}
				let avgKey = valMap[fieldName];
				if(typeof averagePriceData[avgKey] != "undefined"){
					avgValue = averagePriceData[avgKey];
					if(avgKey == 'medianduration'){
						//is in weeks?
						avgValue *= 7;
					}
					hasAverageValue = true;
				}
			}
			if(fieldName == 'registrysize'){
				//bytes to GB
				value = Math.floor(new BigNumber(value).dividedBy(1e+9));
			}


			const $li = $('<li class="'+labelData.field_type+'" />');
			let $field;
			switch(labelData.type){
				case 'boolean':
					
					let selectedClass = '';
					if(value){
						selectedClass = ' isTrue'
					}
					if(!value){
						selectedClass = ' isFalse'
					}
					$field = $(`
					<div class="toggle${selectedClass}">
						<div class="toggleSlider"></div>
						<div class="foreground"></div>
						<div class="background"></div>
						<input id="${fieldName}" value="${value}" type="hidden" />
					</div>`)
					$field.off('mousedown').on('mousedown',()=>{
						let newVal = !value;
						value = newVal;
						let oldClass = selectedClass;
						if(newVal){
							selectedClass = ' isTrue'
						}
						if(!newVal){
							selectedClass = ' isFalse'
						}
						$field.removeClass(oldClass).addClass(selectedClass);
						$('input',$field).val(newVal);
					})
					//$field = $('<select id="'+fieldName+'"></select>')
					/*let trueSelected = '';
					let falseSelected = ''
					if(value){
						trueSelected = ' selected="selected"'
					}
					if(!value){
						falseSelected = ' selected="selected"'
					}
					$field.append('<option value="true"'+trueSelected+'>true</option>')
					$field.append('<option value="false"'+falseSelected+'>false</option>')*/
				break;
				case 'int':
				case 'hastings':
				case 'blocks':
				case 'hastings/byte':
				case 'hastings/byte/block':
					$field = $('<input id="'+fieldName+'" type="number" value="'+value+'" />');
				break;
				default:
					$field = $('<input id="'+fieldName+'" value="'+value+'" />');
				break;
			}
			const $info = $('<span class="info">?</span>');
			$info.on('mouseenter',(event)=>{
				this.showTooltip($info,labelData.info,labelData.label);
			}).on('mouseleave',()=>{
				this.hideTooltip();
			})
			$li.append('<label for="'+fieldName+'">'+labelData.label+'</label>')
			$li.append($info);
			$li.append($field);
			if(hasAverageValue){
				$li.append('<small>[ Top 100 Hosts Average: '+avgValue+' ]</small>')
			}
			$ul.append($li);
		});
		const $ports = $('<ul class="hostPorts advanced"><div class="portsTitle">Sia Host Ports</div></ul>');
		if(portsData.portsSet){
			
			const $rpcAddr = $('<li><label for="rpcPort">RPC Port (default 9981)</label><input id="rpcPort" data-key="rpc" type="number" placeholder="default: 9981" value="'+portsData.rpc+'" /></li>')
			const $hostAddr = $('<li><label for="hostPort">Host Port (default 9982)</label><input id="hostPort" data-key="host" type="number" placeholder="default: 9982" value="'+portsData.host+'" /></li>')
			const $muxAddr = $('<li><label for="muxPort">Multiplexer Port (default 9983)</label><input id="muxPort" data-key="mux" type="number" placeholder="default: 9983" value="'+portsData.mux+'" /></li>')
			const $muxWSAddr = $('<li><label for="muxWSPort">Multiplexer WS Port (default 9984)</label><input id="muxWSPort" data-key="muxWS" type="number" placeholder="default: 9984" value="'+portsData.muxWS+'" /></li>')
			$ports.append($rpcAddr);
			$ports.append($hostAddr);
			$ports.append($muxAddr);
			$ports.append($muxWSAddr);
		}
		const $advancedLink = $('<div class="advancedToggle"><a>Advanced Settings</a></div>')
		const $submit = $('<div class="buttons" />');
		const $cancel = $('<div class="button cancel"><div class="foreground">cancel</div><div class="background">cancel</div></div>');
		const $save = $('<div class="button save"><div class="foreground">save</div><div class="background">save</div></div>')
		$submit.append($save);
		$submit.append($cancel);
		
		//$ul.append($submit);
		$el.html($ul);
		$el.append($ports);
		$el.append($advancedLink);
		$el.append($submit);

		$('.advancedToggle a').off('click').on('click',()=>{
			$('.advanced',$el).toggleClass('visible');
			if($('.advancedToggle a').hasClass('isVisible')){
				$('.advancedToggle a').removeClass('isVisible');
				$('.advancedToggle a').html('Show Advanced Settings')
			}
			else{
				$('.advancedToggle a').addClass('isVisible');
				$('.advancedToggle a').html('Hide Advanced Settings')
			}
		})
		//todo cancel hides form
		$save.off('click').on('click',()=>{
			this.submitForm(fields,$ports,portsData);
		})
	}
	showTooltip($element,text,label){
		$('#tooltip').html('<div class="title">'+label+'</div>'+text);
		let rect = $element[0].getBoundingClientRect();
		const x = rect.left + rect.width + 5;
		let y = rect.top;
		if(rect.top + $('#tooltip').height() > $(window).height()){
			y = y - ( (rect.top + $('#tooltip').height()) - $(window).height() +50)
		}
		$('#tooltip').css({
			left:x,
			top:y
		})
		$('#tooltip').show();
	}
	hideTooltip(){
		$('#tooltip').hide();
	}
	submitForm(fields,$ports,portsDataIN){
		let formOutput = {};
		let hasValidationErrors = false;
		Object.keys(fields).map(fieldKey=>{
			let fieldMeta = fields[fieldKey];
			let formVal;
			let formElement;
			if(fieldMeta.type == 'boolean'){
				/*formElement = $(`select#${fieldKey}`);
				formVal = $('option:selected',formElement).val();
				formVal = formVal == 'false' ? false : true;*/
				formElement = $('input#'+fieldKey);
				formVal = formElement.val() == 'false' ? false : true;
			}
			else{
				formElement = $(`input#${fieldKey}`)
				formVal = formElement.val();
			}
			//console.log('formval',formVal,fieldKey)
			let value = formVal;
			//convert back to hastings
			if(fieldMeta.type.indexOf('hastings') >= 0){
				//convert to hastings
				value = siacoinsToHastings(value).toString();
			}
			if(fieldKey == 'mindownloadbandwidthprice' || fieldKey == 'minuploadbandwidthprice' || fieldKey == 'collateral' || fieldKey == 'minstorageprice'){
				//SC/TB
				value = new BigNumber(value).dividedBy(1e+6).dividedBy(1e+6).toString();
			}
			if(fieldKey == 'collateral' || fieldKey == 'minstorageprice'){
				//SC/TB/Month
				value = new BigNumber(value).dividedBy(144 * 28).toString();
			}
			if(fieldMeta.type == 'bytes'){
				//set to MB
				value = new BigNumber(value).times(1e+6).toString();
			}
			if(fieldMeta.type == 'blocks'){
				//convert to days
				value = new BigNumber(value).times(144).toString();
			}
			if(fieldKey == 'registrysize'){
				//convert GB to bytes
				value = new BigNumber(value).times(1e+9);
			}
			//console.log('postval',value == fieldMeta._ogVal.toString());
			formOutput[fieldKey] = value;
			let formElementParent = formElement.parent('li');
			formElementParent.find('.error').remove();
			formElement.removeClass('hasError');
			if(isNaN(value) && fieldMeta.type != 'string'){
				//notify
				formElement.addClass('hasError');
				formElementParent.append('<div class="validation error">* invalid data</div>');
				hasValidationErrors = true;
			}
		});
		let portsDataOUT = {};
		let portsIndex = {};
		$('li',$ports).each(function(){
			$('.validation.error',$(this)).remove();
			const key = $('input',this).attr('data-key');
			const val = $('input',this).val();
			if(val == ''){
				let defaultPort;
				switch(key){
					case 'rpc':
						defaultPort = '9981';
					break;
					case 'host':
						defaultPort = '9982';
					break;
					case 'mux':
						defaultPort = '9983';
					break;
					case 'muxWS':
						defaultPort = '9984';
					break;
				}

				portsDataOUT[key] = defaultPort;
			}
			else{
				portsDataOUT[key] = val;
				portsIndex[val] = key;
			}
		});
		//check ports for redlisted
		if(typeof portsDataIN.redlist != "undefined"){
			console.log('ports in',portsDataIN.redlist);
			Object.keys(portsDataIN.redlist.default).map(port=>{
				if(port.indexOf(':') == -1){
					//not a range
					if(typeof portsIndex[port] != "undefined"){
						//ERROR
						hasValidationErrors = true;
						$('input[data-key="'+portsIndex[port]+'"]',$ports).after('<div class="validation error">* reserved port</div>')
					}
				}
				else{
					let rangeArray = port.split(':').map(v=>{
						return parseInt(v);
					});
					Object.keys(portsIndex).map(p=>{
						let targetPort = parseInt(p);
						if(p >= rangeArray[0] && p <= rangeArray[1]){
							//ERROR
							hasValidationErrors = true;
							$('input[data-key="'+portsIndex[p.toString()]+'"]',$ports).after('<div class="validation error">* reserved port ('+port+')</div>')
						}
					})
				}
			});
			Object.keys(portsDataIN.redlist.custom).map(port=>{
				if(portsDataIN.redlist.custom[port].service == "SC"){
					return; //dont care about SC
				}
				if(typeof portsIndex[port] != "undefined"){
					//ERROR
					hasValidationErrors = true;
					$('input[data-key="'+portsIndex[port]+'"]',$ports).after('<div class="validation error">* reserved port</div>')
				}
			})
		}
		
		if(hasValidationErrors){
			return;
		}
		console.log('output',formOutput);
		fetch("/api/sia/updateHostConfig",
		{
		    headers: {
		      'Accept': 'application/json',
		      'Content-Type': 'application/json'
		    },
		    method: "POST",
		    body: JSON.stringify(formOutput)
		})
		.then((res)=>{ 
			console.log('success',res) 
			this.showSaveConfirmationModal(res)
		})
		.catch((res)=>{ 
			console.log('error submitting',res)
			this.showSaveConfirmationModal(res,true)
		})
		
		console.log('portsdata',portsDataOUT);
		fetch("/api/sia/setPorts",
		{
		    headers: {
		      'Accept': 'application/json',
		      'Content-Type': 'application/json'
		    },
		    method: "POST",
		    body: JSON.stringify(portsDataOUT)
		})
		.then((res)=>{ 
			console.log('success submitting ports',res) 
		})
		.catch((res)=>{ 
			console.log('error submitting ports',res)
		});
		//todo submit output
	}
	showSaveConfirmationModal(result,isError){
		let emoji = isError ? '⚠️' : '🥳';
		let message = isError ? 'Error saving Host Data: '+result.message : 'Success! You saved your host information.'
		$('#hostInfoModal').show();
		$('#hostInfoModal #hostDone').off('click').on('click',()=>{
			$('#hostInfoModal').hide();
		})
	}
	getAveragePricing(){
		const uri = 'https://siastats.info/dbs/top100.json';
		return new Promise((resolve,reject)=>{
			fetch(uri).then(res=>{
				return res.json();
			}).then(data=>{
				resolve(data);
			}).catch(error=>{
				resolve({});
			})
		})
	}
	getAveragePricingChart(){
		/*const storageURI = 'https://siastats.info/dbs/storagepricesdb.json';
		const bandwidthURI = 'https://siastats.info/dbs/bandwidthpricesdb.json';

		return new Promise((resolve,reject)=>{
			let hasCompleted = 0;
			fetch(storageURI).then(res=>{
				return res.json()
			}).then(data=>{

			})
		})*/
	}
	getConfig(){
		
		return new Promise((resolve,reject)=>{
			fetch('/api/sia/getHostConfig').then(res=>res.json()).then(data=>{
				resolve(data);
			}).catch(e=>{
				reject(e);
			})
			
		});
		
	}
	getPorts(){
		return new Promise((resolve,reject)=>{
			fetch('/api/sia/getPorts').then(d=>d.json()).then(data=>{
				resolve(data);
			}).catch(error=>{
				reject(error);
			})
		})
	}
}