import {CommonUtils} from '../CommonUtils.js';

export class DVPNNodeConfig{
	constructor(){
		this.utils = new CommonUtils();
		fetch('./uiFragments/dvpn/nodeConfig.html').then(res=>res.text()).then(fragment=>{
			$('body').append(fragment);
			//this.initWallet();
		})
	}
	show(){
		$('#nodeConfigInfo').show();

	}
	hide(){
		$('#nodeConfigInfo').hide();
	}
	showWalletInit(){
		$('.walletUtil').removeClass('showing');
		$('#walletInitModal').show();
		this.showInitModal();
		$('#closeModal').off('click').on('click',()=>{
			this.hideModal();
		})
	}
	checkPWMatch(){
		if($('#confirmPW').val() == ''){
			$('.pwErrorMessage').html('Encryption password cannot be blank.').show();
			return false;
		}
		if($('#confirmPW').val() == $('#encryptionPW').val() && $('#confirmPW').val().length < 8){
			$('.noConfirmBadge').show();
			$('.pwErrorMessage').html('Passwords must be at least 8 characters').show();
			return false;
		}
		if($('#confirmPW').val() != $('#encryptionPW').val()){
			$('.noConfirmBadge').show();
			$('.pwErrorMessage').html('Passwords do not match').show();
			return false;
		}
		else{
			$('.pwErrorMessage').html('').hide();
			$('.noConfirmBadge').hide();
			$('.confirmBadge').show();
			return true;
		}
	
	}
	checkWalletName(){
		//make sure its not blank
		if($('#walletName').val() == ''){
			$('.pwErrorMessage').html('Wallet Name cannot be blank.').show();
			return false;
		}
		else{
			$('.pwErrorMessage').html('').hide();
			return true;
		}
	}
	showInitModal(){
		$('.walletUtil').addClass('showing');
		$('.noConfirmBadge').hide();
		$('.confirmBadge').hide();
		$('.pwErrorMessage').hide();
		$('#walletInitModal').show();
		$('.walletUtil #importWallet').removeClass('canSave');
		$('.walletUtil #importWallet .foreground, .walletUtil #importWallet .background').html('Import Wallet');
		$('.walletUtil #createNewWallet').removeClass('isSubmitting');
		$('.walletUtil #createNewWallet .foreground, .walletUtil #createNewWallet .background').html('Create New Wallet');
		$('#confirmPW').off('change').on('change',()=>{
			const pwMatch = this.checkPWMatch();
			if(!pwMatch){
				return;
			}
		});
		$('.walletUtil #createNewWallet').off('click').on('click',()=>{
			const pwMatch = this.checkPWMatch();
			const walletHasLength = this.checkWalletName();
			if(!pwMatch){
				return;
			}
			if(!walletHasLength){
				return;
			}
			if($('.walletUtil #createNewWallet').hasClass('isSubmitting')){
				return;
			}
			$('.walletUtil #createNewWallet').addClass('isSubmitting');
			$('.walletUtil #createNewWallet .foreground, .walletUtil #createNewWallet .background').html('Loading...');
			const formOutput = {
				pw:$('#encryptionPW').val(),
				walletName:$('#walletName').val(),
				import:false
			}
			//console.log('form output',formOutput);
			//create wallet

			fetch("/api/dvpn/initWallet",
			{
			    headers: {
			      'Accept': 'application/json',
			      'Content-Type': 'application/json'
			    },
			    method: "POST",
			    body: JSON.stringify(formOutput)
			})
			.then((res)=>{ console.log('success'); return res.json(); }).then(data=>{
				console.log('res data',data);

				$('.walletUtil').removeClass('showing');
				if(typeof data.error != "undefined" ){
					this.showErrorModal('Error: '+data.error);
					return;
				}
				$('.newWalletInfo #addressOut').html('<div class="label">Address:</div>')
				$('.newWalletInfo #addressOut').append(`<div class="address">${data.operator}</div>`);
				$('.newWalletInfo #mnemonicOut').html(data.mnemonic)
				$('.newWalletInfo').addClass('showing');
				this.initMnemonicConfirmation();
				this.getNodeConfigData();
			})
			.catch((res)=>{ console.log('error submitting',res) })
			
		});
		$('.walletUtil #importWallet').off('click').on('click',()=>{
			//show mnemonic textarea
			const pwMatch = this.checkPWMatch();
			const walletHasLength = this.checkWalletName();
			if(!pwMatch){
				return;
			}
			if(!walletHasLength){
				return;
			}
			if(!$('.walletUtil #importWallet').hasClass('opened')){
				$('.walletUtil #mnemonicWrap').css({
					opacity:1,
					height: '100px'
				});
				$('.walletUtil #importWallet').addClass('opened');
				$('.walletUtil #importWallet').removeClass('save').addClass('cancel');
				$('.walletUtil #importWallet .foreground, .walletUtil #importWallet .background').html('Import Wallet Seed')
			}
			else{
				//submit mnemonic
				if($('.walletUtil #importWallet').hasClass('canSave')){
					//submit the form
					console.log('submit');
					$('.walletUtil #importWallet').removeClass('canSave');
					$('.walletUtil #importWallet .foreground, .walletUtil #importWallet .background').html('Importing Seed...')
					/*let returnTimeout = setTimeout(()=>{
						//hopefully it's rescanning our wallet. check to be safe
						this.verifyImportFromSeed();
					},10000);*/
					const formOutput = {
						pw: $('#encryptionPW').val(),
						import:true,
						walletName:$('#walletName').val(),
						seed: $('.walletUtil #mnemonic').val()
					}
					console.log('form output',formOutput);
					//create wallet
					fetch("/api/dvpn/initWallet",
					{
					    headers: {
					      'Accept': 'application/json',
					      'Content-Type': 'application/json'
					    },
					    method: "POST",
					    body: JSON.stringify(formOutput)
					})
					.then((res)=>{ console.log('success'); return res.json(); }).then(data=>{
						//clearTimeout(returnTimeout);
						console.log('success res data',data);
						if(typeof data.error == "undefined"){
							this.verifyImportFromSeed('Wallet Import Success! <br /> Your Address: '+data.operator);
						}
						else{
							this.showErrorModal(data.error);
						}
					})
					.catch((res)=>{  
						console.log('error submitting',res);
						//if(typeof data.error != "undefined" ){
							this.showErrorModal('Error: '+res);
						//}
					})
				}
			}
		})
		$('.walletUtil #mnemonic').off('input').on('input',()=>{
			let wordLen = $('.walletUtil #mnemonic').val().trim().split(' ').length;
			console.log('updated',wordLen);
			if(wordLen == 24){
				$('.walletUtil #importWallet').addClass('save').removeClass('cancel');
				$('.walletUtil #importWallet').addClass('canSave');
			}
			else{
				$('.walletUtil #importWallet').removeClass('save').addClass('cancel').removeClass('canSave');
			}
		})
	}
	showErrorModal(message){
		$('.seedImportMessage .error').html(message);
		$('.seedImportMessage .error').show();
		$('.seedImportMessage .success').hide();
		$('.walletUtil').removeClass('showing');
		$('.seedImportMessage').addClass('showing');
		this.handleVerifyModalHide(true);
	}
	verifyImportFromSeed(message){
		console.log('verify data',message);
		//$('.messageText').html('a wallet aaddress')
		$('.seedImportMessage .success .messageText').html(message);
		
		$('.seedImportMessage .error').hide();
		$('.seedImportMessage .success').show();
		$('.walletUtil').removeClass('showing');
		$('.seedImportMessage').addClass('showing');
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
		$('#importSeedMessageConf').off('click').on('click',()=>{
			this.hideModal()
			if(wasError){
				this.showWalletInit();
			}
			else{
				this.getNodeConfigData();
			}
		})
	}
	hideModal(){
		$('.walletModalContent').removeClass('showing');
		$('#walletInitModal').hide();
		$('#confirmPW').val('');
		$('#encryptionPW').val('');
		$('#walletName').val('');
		$('textarea#mnemonic').val('');
		$('.walletUtil').addClass('showing');
		$('.seedImportMessage').removeClass('showing');
	}
	showAllKeysModal(){
		$('#getKeys').removeClass('selectWallet');
		$('#getKeys .foreground, #getKeys .background').html('Get Wallets')
		$('#walletInitModal').show();
		$('.walletModalContent').removeClass('showing');
		$('.getKeysModal').addClass('showing');
		$('#getKeys').off('click').on('click',()=>{
			if($('#getKeys').hasClass('selectWallet')){
				const wallet = $('.getKeysModal .allKeys select option:selected').val();
				const address = $('.getKeysModal .allKeys select option:selected').attr('data-addr');
				$('#nodeConfigInfo input#from').val(wallet);
				$('#nodeConfigInfo input#operatorAddress').val(address);
				$('.getKeysModal .allKeys').hide();
				$('.getKeysModal .allKeys select').html('');
				$('#unlockPW').val('');
				this.hideModal();
				return;
			}
			fetch("/api/dvpn/getWallets",
			{
			    headers: {
			      'Accept': 'application/json',
			      'Content-Type': 'application/json'
			    },
			    method: "POST",
			    body: JSON.stringify({pw:$('#unlockPW').val()})
			})
			.then((res)=>{ console.log('success'); return res.json(); }).then(data=>{
				console.log('res data',data);
				$('#getKeys').addClass('selectWallet');
				$('#getKeys .foreground, #getKeys .background').html('Select Wallet')
				this.displayKeys(data);
			})
			.catch((res)=>{ console.log('error submitting',res) });
		})
		$('#cancelGetKeys').off('click').on('click',()=>{
			$('#unlockPW').val('');
			$('.getKeysModal .allKeys').hide();
			$('.getKeysModal .allKeys select').html('');
			this.hideModal();
		})
	}
	displayKeys(data){
		const currentlySelected = $('#nodeConfigInfo input#from').val();
		const $select = $('.getKeysModal .allKeys select');
		$select.html('');
		Object.keys(data).map(key=>{
			const addr = data[key];
			const isSelected = currentlySelected == key ? ' selected="selected"' : '';
			$select.append(`<option${isSelected} value="${key}" data-addr="${addr}">${key} | ${addr}</option>`)
		});
		$('.getKeysModal .allKeys').show();

	}
	initMnemonicConfirmation(){
		$('.newWalletInfo #mnemonicConfirmation0').off('click').on('click',()=>{
			$('.newWalletInfo #mnemonicConfirmation1').show();
			$('.newWalletInfo #mnemonicConfirmation0').removeClass('save').addClass('cancel');
		});
		$('.newWalletInfo #mnemonicConfirmation1').off('click').on('click',()=>{
			let len = $('#mnemonicOut').html().length;
			let str = Array.from($('#mnemonicOut').html());
			let i=0;
			let sI = setInterval(()=>{
				if(str[i] != ' '){
					str[i] = '🔥';
				};
				i+= 1;
				$('#mnemonicOut').html(str.join(''));
				if(i == len){
					clearInterval(sI);
					$('.newWalletInfo').removeClass('showing');
					setTimeout(()=>{
						$('#walletInitModal').hide();
						$('#confirmPW').val('');
						$('#encryptionPW').val('');
						$('.newWalletInfo #mnemonicConfirmation1').hide();
						$('.newWalletInfo #mnemonicConfirmation0').addClass('save').removeClass('cancel');
					},300);
				}
			},10);
		})
	}

	getNodeConfigData(){
		const _this = this;
		this.show();
		const sectionValues = {
			'chain': 'Chain Settings',
			'node' : 'Node Settings',
			'keyring' : 'Keyring Settings'
		};
		const labelValues = {
			gas_adjustment: {
				label:'Gas Adjustment',
				notes:'Gas adjustment factor',
				type:'advanced'
			},
			gas_prices:{
				label:'Gas Price',
				notes:'Gas prices to determine the transaction fee',
				type:'advanced'
			},
			gas: {
				label:'Gas',
				notes:'Gas limit to set per transaction',
				type:'advanced'
			},
			id:{
				label:'Network ID',
				notes:'Example: sentinel-turing-4, or sentinelhub-2',
				type:'advanced'
			},
			rpc_address:{
				label:'RPC Address',
				notes:'',
				type:'advanced'
			},
			simulate_and_execute:{
				label:'Simulate and Execute',
				notes:'Calculate the approx gas units before broadcast',
				type:'advanced'

			},
			from: {
				label:'Wallet Name',
				notes:'',
				type:'all'
			},
			listen_on: {
				label:'Listen PORT',
				notes:'example: 8585. Open this port (TCP) <span class="myLocalIP"></span> on your network router.',
				type:'all'
			},
			moniker:{
				label:'Moniker',
				notes:'example: feisty-penguin-bicycle-4',
				type:'all'
			},
			price:{
				label:'Price',
				notes:'Per Gigabyte price to charge against the provided bandwidth',
				type:'all'
			},
			remote_url:{
				label:'Host Remote URL',
				notes:'Your global address, example: sentinel.hopto.org, or 1.23.45.67 <a class="getMyIP">Get My Global IP Address</a> <span class="myIPValue"></span>',
				type:'all'
			},
			listen_port:{
				label:'Listen Port',
				notes: 'Wireguard Port. Open this port (UDP) <span class="myLocalIP"></span> on your network router.',
				type:'all'
			},
			interval_set_sessions:{
				label: "Set Sessions Interval ",
				notes: "Time interval between each set_sessions operation; Format: 0h0m0s",
				type:'advanced'
			},
			interval_update_sessions:{
				label:'Update Sessions Interval',
				notes:"Time interval between each update_sessions transaction; Format: 0h0m0s",
				type:'advanced'
			},
			interval_update_status:{
				label: 'Update Status Interval',
				notes:"Time interval between each update_status transaction; Format: 0h0m0s",
				type:'advanced'
			}
		}
		fetch('/api/dvpn/getConfigs').then(d=>d.json()).then(config=>{
			const operator = config.operator;
			const data = config.config;
			Object.keys(data).map(formKey=>{
				const $ul = $('#nodeConfigInfo #'+formKey+'Configuration ul.topLevel');
				$ul.html('');
				Object.keys(data[formKey]).map(key=>{
				
				//Object.keys(data.node).map(key=>{
					
					let sectionData = data[formKey][key];
					
					if(sectionData.leaf){
						
						//is top level data
						const strlen = sectionData.value.length == 0 ? 40 : sectionData.value.length;
						
						let $inputElem = $('<input data-config="'+formKey+'" data-section="'+key+'" id="'+key+'" size="'+(strlen+2)+'" data-type="'+sectionData.type+'" type="'+sectionData.type+'" value="'+sectionData.value+'" />');

						const $li = $('<li class="hasInput"></li>')
						$li.append('<label for="'+key+'">'+labelValues[key].label+'</label>')
						$li.append($inputElem)
						$li.append('<div class="notes">'+labelValues[key].notes+'</div>')
						$ul.append($li);
					}
					else{
						//is section heading, recurse
						if(typeof sectionValues[key] == "undefined"){
							return;
						}
						let titleClass = 'all';
						if(sectionValues[key] == 'Chain Settings'){
							titleClass = "advanced";
						}
						const $heading = $('<li class="title '+titleClass+'">'+sectionValues[key]+'</li>');
						const $li = $('<li><ul /></li>');
						recurse(sectionData,key,formKey,$li);
						$ul.append($heading);
						$ul.append($li);
					}
				})
				$('.getMyIP',$ul).off('click').on('click',()=>{
					fetch('/api/akt/getGlobalIP').then(d=>d.json()).then(d=>{
						const ip = d.global_ip;
						$('.myIPValue').html(': '+ip);
					})	
				});
				this.utils.getIP().then(data=>{
					$('.myLocalIP',$ul).html(' for IP: '+data.ip);
				})

			});


			function recurse(sectionData,key,parentKey,$parentLi){
				const $ul = $('ul',$parentLi);
				console.log('parentKey',parentKey);
				console.log('key',key);
				Object.keys(sectionData).map(sectionKey=>{

					const data = sectionData[sectionKey];
					const inputType = data.type;
					let strlen = 0;
					if(typeof data.value != "boolean"){
						strlen = data.value.length == 0 ? 40 : data.value.length;
					}
					if(sectionKey == 'listen_on'){
						data.value = data.value.split(':');
						data.value = data.value[data.value.length - 1];
					}
					if(sectionKey == 'remote_url'){
						//strip protocol and port
						data.value = data.value.split('://')[1].split(':')[0];
					}
					
					let $inputElem = $('<input data-config="'+parentKey+'" data-section="'+key+'" id="'+sectionKey+'" size="'+(strlen+2)+'" data-type="'+inputType+'" type="'+inputType+'" value="'+data.value+'" />');
					const $li = $('<li class="hasInput '+labelValues[sectionKey].type+'" />');
					
					if(data.type == 'boolean'){
						let selectedClass = '';
						let value = data.value == 'true' ? true : false;
						if(value){
							selectedClass = ' isTrue'
						}
						if(!value){
							selectedClass = ' isFalse'
						}

						
						$inputElem = $(`
						<div class="toggle${selectedClass}">
							<div class="toggleSlider"></div>
							<div class="foreground"></div>
							<div class="background"></div>
							<input data-config="${parentKey}" data-section="${key}" id="${sectionKey}" data-type="${data.type}" value="${value}" type="hidden" />
						</div>`)
						$inputElem.off('mousedown').on('mousedown',()=>{
							let newVal = !value;
							value = newVal;
							let oldClass = selectedClass;
							if(newVal){
								selectedClass = ' isTrue'
							}
							if(!newVal){
								selectedClass = ' isFalse'
							}
							$inputElem.removeClass(oldClass).addClass(selectedClass);
							$('input',$inputElem).val(newVal);
						})
						$li.append('<label class="toggleTitle">'+labelValues[sectionKey].label+'</label>')
						$li.append($inputElem);
					}
					else{
						console.log('key',sectionKey,labelValues)
						if(typeof labelValues[sectionKey] == "undefined"){
							return;
						}
						$li.append('<label for="'+sectionKey+'">'+labelValues[sectionKey].label+'</label>')
						$li.append($inputElem);
						if(sectionKey == 'from'){
							const $showAllKeys = $('<div class="showAllKeys">Choose Another Wallet</div>');
							$li.append($showAllKeys);
							$showAllKeys.off('click').on('click',()=>{
								_this.showAllKeysModal();
							})
						}
						else{
							$li.append('<div class="notes">'+labelValues[sectionKey].notes+'</div>')
						}
					}
					$ul.append($li)

				})
				$ul.append('<input type="hidden" value="'+operator+'" id="operatorAddress" />');
			}
			$('#showAdvancedSettings').off('click').on('click',()=>{
				$('.advanced').toggleClass('showAdvanced');
			})
			this.activateSaveButton();
		})
	}
	checkRedlistPorts(ports){
		return new Promise((resolve,reject)=>{
			const node = ports.node.replace(/"/gi,'').toString();
			const wg = ports.wireguard.toString();
			let portsIndex = {}
			console.log('node wg',node,wg);
			portsIndex[node] = "listen_on";
			portsIndex[wg] = "listen_port";
			console.log('ind',portsIndex);
			let hasValidationErrors = false;
			fetch('/api/dvpn/getPortsRedlist').then(d=>d.json()).then(redlist=>{
				if(typeof redlist != "undefined"){
					console.log('ports in',redlist);
					Object.keys(redlist.default).map(port=>{
						if(port.indexOf(':') == -1){
							//not a range
							if(typeof portsIndex[port] != "undefined"){
								//ERROR
								hasValidationErrors = true;
								console.log('validation err',portsIndex[port],port)
								$('#nodeConfigInfo input[data-section="'+portsIndex[port]+'"]').after('<div class="validation error">* reserved port</div>')
								//$('input[data-key="'+portsIndex[port]+'"]',$ports).after('<div class="validation error">* reserved port</div>')
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
									console.log('validation err',portsIndex[p],port)
									$('#nodeConfigInfo input[data-section="'+portsIndex[p.toString()]+'"]').after('<div class="validation error">* reserved port ('+port+')</div>')
									//$('input[data-key="'+portsIndex[p.toString()]+'"]',$ports).after('<div class="validation error">* reserved port ('+port+')</div>')
								}
							})
						}
					});
					Object.keys(redlist.custom).map(port=>{
						if(redlist.custom[port].service == "DVPN"){
							return; //dont care about SC
						}
						if(typeof portsIndex[port] != "undefined"){
							//ERROR
							hasValidationErrors = true;
							console.log('validation err',portsIndex[port],port)
							$('#nodeConfigInfo input[data-section="'+portsIndex[port]+'"]').after('<div class="validation error">* reserved port</div>')
							//$('input[data-key="'+portsIndex[port]+'"]',$ports).after('<div class="validation error">* reserved port</div>')
						}
					})
				}
				resolve(hasValidationErrors);
			});
		})
		
	}
	activateSaveButton(){
		const _this = this;
		let portsData = {};
		$('#saveNodeConfigs').off('click').on('click',()=>{
			const output = {};
			$('#nodeConfigInfo .validation.error').remove();
			$('#nodeConfigInfo input:not(#operatorAddress)').each(function(){
				const $input = $(this);
				const val = $input.val();
				const topLevelConfig = $input.attr('data-config');
				const secondLevelConfig = $input.attr('data-section');
				const configKey = $input.attr('id');
				const type = $input.attr('data-type');
				let value = val;
				if(type == 'number'){
					value = parseFloat(value);
				}
				if(type == 'string'){
					value = '"'+value+'"'
				}
				if(type == 'boolean'){
					value = value == 'true' ? true : false;
				}
				if(configKey == 'listen_on'){
					console.log('value',value);
					value = '0.0.0.0:'+val;
				}
				if(configKey == 'remote_url'){

					value = 'https://'+val+':'+(portsData.node.replace(/"/gi,''));
				}
				if(typeof output[topLevelConfig] == "undefined"){
					output[topLevelConfig] = {};
				}
				if(topLevelConfig == 'wireguard'){
					//wg only has top level
					output[topLevelConfig][configKey] = value;
					if(configKey == 'listen_port'){
						portsData.wireguard = value;
					}
				}
				else{
					if(typeof output[topLevelConfig][secondLevelConfig] == "undefined"){
						output[topLevelConfig][secondLevelConfig] = {}
					}
					output[topLevelConfig][secondLevelConfig][configKey] = value;
					if(configKey == 'listen_on'){
						portsData.node = value.split(':');
						portsData.node = portsData.node[portsData.node.length-1];
					}
				}
			})
			const operator = $('#nodeConfigInfo #operatorAddress').val();
			
			this.checkRedlistPorts(portsData).then(hasErrors=>{
				if(hasErrors){
					return;
				}
				fetch("/api/dvpn/updateNodeConfig",
				{
				    headers: {
				      'Accept': 'application/json',
				      'Content-Type': 'application/json'
				    },
				    method: "POST",
				    body: JSON.stringify({config:output,operator})
				})
				.then((res)=>{ console.log('success'); return res.json(); }).then(data=>{
					console.log('res data',data);
					$('.walletUtil').removeClass('showing');
					$('#walletInitModal').show();
					this.verifyImportFromSeed('Saved Node Config!');

				})
				.catch((res)=>{ 
					$('.walletUtil').removeClass('showing');
					$('#walletInitModal').show();
					this.showErrorModal('Error: '+res); 
					console.log('error submitting',res);

				});
			})
			

		});
		$('#nodeConfigInfo #cancel').off('click').on('click',()=>{
			this.getNodeConfigData();
		})
	}
}