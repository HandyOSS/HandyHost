import {AKTClusterConfig} from './AKTClusterConfig.js';

export class AKTNodeConfig{
	constructor(){
		fetch('./uiFragments/akt/nodeConfig.html').then(res=>res.text()).then(fragment=>{
			$('body').append(fragment);
			//this.initWallet();
			this.clusterConfig = new AKTClusterConfig($('#nodeConfiguration'),this);
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
		$('.closeWalletInitModal').off('click').on('click',()=>{
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

			fetch("/api/akt/initWallet",
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
				$('.newWalletInfo #addressOut').append(`<div class="address">${data.address}</div>`);
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
					fetch("/api/akt/initWallet",
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
							this.verifyImportFromSeed('Wallet Import Success! <br /> Your Address: '+data.address);
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
	showGenericErrorModal(message,$modalEl){
		$('.seedImportMessage .error').html(message);
		$('.seedImportMessage .error').show();
		$modalEl.removeClass('showing');
		$('.seedImportMessage').addClass('showing');
		$('.seedImportMessage .success').hide();
		$('#importSeedMessageConf').off('click').on('click',()=>{
			this.hideModal()
			
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
	showBuildABoxModal(){
		$('#finishHost').addClass('nonActive');
		$('#buildABoxModal #autoConfig .chooseDeviceResult').html('');
		$('#setHostname').val('');
		$('#buildABoxModal #autoConfig .confirmation').hide();
		$('#walletInitModal').show();
		$('.walletModalContent').removeClass('showing');
		$('#buildABoxModal').addClass('showing');
		$('.closeWalletInitModal').off('click').on('click',()=>{
			this.hideModal();
		})
		
	}
	showBuildAX86BoxModal(){
		$('#buildAX86BoxModal #autoConfig .confirmation').hide();
		$('#walletInitModal').show();
		$('.walletModalContent').removeClass('showing');
		$('#buildAX86BoxModal').addClass('showing');
		$('.closeWalletInitModal').off('click').on('click',()=>{
			this.hideModal();
		})
	}
	showSSHSetupModal(nodeData){
		//setupSSHModal
		$('#walletInitModal').show();
		$('.walletModalContent').removeClass('showing');
		$('.setupSSHModal').addClass('showing');
		$('#setupSSH').off('click').on('click',()=>{
			let user = $('#sshUser').val();
			if(user == ''){
				user = 'ubuntu'; //default
			}
			const pw = $('#sshPW').val();
			const output = {
				node:nodeData,
				user:user,
				pw:pw
			}
			fetch("/api/akt/enableSSHForNode",
			{
			    headers: {
			      'Accept': 'application/json',
			      'Content-Type': 'application/json'
			    },
			    method: "POST",
			    body: JSON.stringify(output)
			})
			.then((res)=>{ console.log('success'); return res.json(); }).then(data=>{
				console.log('res data',data);
				$('#sshPW').val('');
				$('#sshUser').val('');
				
				if(typeof data.config != "undefined"){
					this.clusterConfig.renderClusterConfig(data.config);
					this.hideModal();
				}
				if(typeof data.error != "undefined"){
					this.showGenericErrorModal('Error: '+data.error,$('.setupSSHModal'));
				}
				
			})
			.catch((res)=>{ 
				$('#sshPW').val('');
				$('#sshUser').val('');
				console.log('error submitting',res) 
				this.showGenericErrorModal('Error: '+res.error,$('.setupSSHModal'));
			});
		})
		$('#cancelSSH').off('click').on('click',()=>{
			$('#sshPW').val('');
			$('#sshUser').val('');
			this.hideModal();
		})
	}
	showAddDiskModal(nodeData){
		//setupSSHModal
		$('#walletInitModal').show();
		$('.walletModalContent').removeClass('showing');
		$('.addDiskModal').addClass('showing');

		//first fetch disks..
		const target = {
			node:nodeData
		}
		fetch("/api/akt/getDisks",
		{
		    headers: {
		      'Accept': 'application/json',
		      'Content-Type': 'application/json'
		    },
		    method: "POST",
		    body: JSON.stringify(target)
		})
		.then((res)=>{ return res.json(); }).then(data=>{
			console.log('get disks data',data);
			//this.hideModal();
			const $select = $('.addDiskModal select');
			$select.html('');
			data.map(device=>{
				switch(device.type){
					case 'disk':
						if(device.data.device.indexOf('/dev/sd') == -1){
							return;
						}
						$select.append(`<option value="${device.data.device}">Disk ${device.data.device} : ${device.data.size}</option>`)
					break;
					/*case 'partitions':
						device.data.map(partition=>{
							//partitions
							$select.append(`<option value="partition|${partition.device}|${partition.type}"> ---- Partition ${partition.device} : ${partition.size} (${partition.type})</option>`)
						})
					break;*/
				}
				//$select.append(`<option value="">${device.type}: </option>`)
			})
		})
		.catch((res)=>{ console.log('error submitting',res) });

		$('#addDisk').off('click').on('click',()=>{
			if($('#addDisk').hasClass('waiting')){
				return;
			}
			const disk = $('.addDiskModal select option:selected').val();
			if(typeof disk == "undefined"){
				return;
			}
			$('#addDisk .foreground, #addDisk .background').html('Formatting Disk...')
			$('#addDisk').addClass('waiting');

			const output = {
				node:nodeData,
				disk
			}
			fetch("/api/akt/addDisk",
			{
			    headers: {
			      'Accept': 'application/json',
			      'Content-Type': 'application/json'
			    },
			    method: "POST",
			    body: JSON.stringify(output)
			})
			.then((res)=>{ console.log('success'); return res.json(); }).then(data=>{
				console.log('res data',data);
				if(data.success){
					$('#addDisk').removeClass('waiting');
					$('#addDisk .foreground, #addDisk .background').html('Format &amp; Mount Disk')
					//.data = config
					this.hideModal();
					this.clusterConfig.renderClusterConfig(data.config);
					this.clusterConfig.activateSaveButton();
				}
				else{
					this.showErrorModal('Error: '+data);
				}
				//this.hideModal();
				
				
			})
			.catch((res)=>{ 
				$('#addDisk').removeClass('waiting');
				$('#addDisk .foreground, #addDisk .background').html('Format &amp; Mount Disk')
				console.log('error submitting',res); 
			});
		})
		$('#cancelAddDisk').off('click').on('click',()=>{
			this.hideModal();
		})
	}
	showAllKeysModal(){
		$('#getKeys').removeClass('selectWallet');
		$('#getKeys .foreground, #getKeys .background').html('Get Wallets')
		$('#walletInitModal').show();
		$('.walletModalContent').removeClass('showing');
		$('.getKeysModal').addClass('showing');
		$('#getKeys').off('click').on('click',()=>{
			if($('#getKeys').hasClass('selectWallet')){
				const walletName = $('.getKeysModal .allKeys select option:selected').val();
				const address = $('.getKeysModal .allKeys select option:selected').attr('data-address');

				$('.providerList #providerWalletName').prop('readonly',false);
				$('.providerList #providerWalletName').val(walletName);
				$('.providerList #providerWalletName').prop('readonly',true);
				$('.providerList #providerWalletAddress').val(address);
				$('.getKeysModal .allKeys').hide();
				$('.getKeysModal .allKeys select').html('');
				$('#unlockPW').val('');
				this.hideModal();
				return;
			}
			fetch("/api/akt/getWallets",
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
		console.log('display keys',data);
		const currentlySelected = $('#nodeConfigInfo input#from').val();
		const $select = $('.getKeysModal .allKeys select');
		$select.html('');
		data.map(rec=>{
			const addr = rec.address;
			const key = rec.name;
			const isSelected = currentlySelected == key ? ' selected="selected"' : '';
			$select.append(`<option${isSelected} data-address=${addr} value="${key}">${key} | ${addr}</option>`)
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
		

		return false; //TODO: implement for AKT node/cluster



		const sectionValues = {
			'chain': 'Chain Settings',
			'node' : 'Node Settings',
		};
		const labelValues = {
			gas_adjustment: {
				label:'Gas Adjustment',
				notes:''
			},
			gas_prices:{
				label:'Gas Price',
				notes:''
			},
			gas: {
				label:'Gas',
				notes:''
			},
			id:{
				label:'Network ID',
				notes:'Example: sentinel-turing-4, or sentinelhub-1'
			},
			rpc_address:{
				label:'RPC Address',
				notes:''
			},
			simulate_and_execute:{
				label:'Simulate and Execute',
				notes:''
			},
			from: {
				label:'Wallet Name',
				notes:''
			},
			listen_on: {
				label:'Listen IP:PORT',
				notes:'example: 0.0.0.0:8585. Open this port on your network router.'
			},
			moniker:{
				label:'Moniker',
				notes:'example: feisty-penguin-bicycle-4'
			},
			price:{
				label:'Price',
				notes:''
			},
			remote_url:{
				label:'Host Remote URL',
				notes:'Your global IP:PORT, example: https://1.23.45.67:8585 <a href="https://www.myglobalip.com/" target="_blank">Find My Global IP</a>'
			},
			listen_port:{
				label:'Listen Port',
				notes: 'Wireguard Port. Open this port on your network router.'
			}
		}

		fetch('/api/dvpn/getConfigs').then(d=>d.json()).then(data=>{
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
						$ul.append($li)
					}
					else{
						//is section heading, recurse
						const $heading = $('<li class="title">'+sectionValues[key]+'</li>');
						const $li = $('<li><ul /></li>');
						recurse(sectionData,key,formKey,$li);
						$ul.append($heading);
						$ul.append($li);
					}
				})
			});

			function recurse(sectionData,key,parentKey,$parentLi){
				const $ul = $('ul',$parentLi);
				Object.keys(sectionData).map(sectionKey=>{

					const data = sectionData[sectionKey];
					const inputType = data.type;
					let strlen = 0;
					if(typeof data.value != "boolean"){
						strlen = data.value.length == 0 ? 40 : data.value.length;
					}
					let $inputElem = $('<input data-config="'+parentKey+'" data-section="'+key+'" id="'+sectionKey+'" size="'+(strlen+2)+'" data-type="'+inputType+'" type="'+inputType+'" value="'+data.value+'" />');
					const $li = $('<li class="hasInput" />');
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
			}
		})
	}
	
}