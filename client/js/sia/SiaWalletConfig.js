export class SiaWalletConfig{
	constructor(){
		fetch('./uiFragments/sia/walletConfig.html').then(res=>res.text()).then(fragment=>{
			$('body').append(fragment);
			this.initWallet();
		})
		
	}
	show(){
		/*$('#walletInitModal').show();
		this.showInitModal(); //override*/
		$('.walletUtil').removeClass('showing');
		fetch('/api/sia/getUpdatingStatus').then(res=>res.json()).then(updateStatus=>{
			if(updateStatus.updating){
				//show an error modal because we are mid update. 
				//Dont want to accidentally show a wallet init modal here and freak anybody out...
				this.showErrorModal('Sia Daemon is Currently Updating... This can take anywhere from a minute to (rarely) hours.');
			}
			else{
				this.fetchChainAndWalletData().then(result=>{
					const wallet = result.wallet;
					const chain = result.chain;
					this.isChainSynced = chain.synced;
					if(wallet.height != chain.height || !chain.synced){
						this.showErrorModal('You cannot create or import a new wallet during sync. <br />Chain Synced: '+chain.synced+'<br />Chain Height: '+chain.height+'<br />Wallet Height: '+wallet.height);
					}
					else{
						this.showInitModal(chain.synced);
					}
				})
			}
			$('#walletInitModal').show();
		});
		
	}
	hide(){
		$('#walletInitModal').hide();
	}
	initWallet(){
		this.getSiaPorts().then((result)=>{
			console.log('get sia ports data',result);
			if(result.portsSet){
				fetch('/api/sia/getUpdatingStatus').then(res=>res.json()).then(updateStatus=>{
					if(updateStatus.updating){
						//show an error modal because we are mid update. 
						//Dont want to accidentally show a wallet init modal here and freak anybody out...
						this.showErrorModal('Sia Daemon is Currently Updating... This can take anywhere from a minute to (rarely) hours.');
						$('#walletInitModal').show();
					}
					else{
						this.fetchChainAndWalletData().then((result)=>{
							const wallet = result.wallet;
							const chain = result.chain;
							if(!wallet.encrypted && !wallet.unlocked && !wallet.rescanning){
								//is a new install, we need to make a wallet
								console.log('wallet chain',wallet,chain);
								if(typeof wallet.encrypted == "undefined" && typeof wallet.unlocked == "undefined" && typeof wallet.rescanning == "undefined"){
									$('#walletInitModal').hide();
									console.log('no wallet data');
								}
								else{
									console.log('time for new wallet creation');
									this.showInitModal(chain.synced);
								}
								
							}
							else{
								$('#walletInitModal').hide();
							}
						});
					}
				});
			}
			else{
				//show ports setter modal
				console.log('show ports setter');
				this.showSiaPortsModal(result);

			}
		})
		
		/*fetch('/api/sia/getChainStatus').then(chainRes=>chainRes.json()).then(chainData=>{
			fetch('/api/sia/getWalletInfo').then(res=>res.json()).then(data=>{
				console.log('got wallet data',data);
				console.log('chain data',chainData)
				if(!data.encrypted && !data.unlocked && !data.rescanning){
					//is a new install, we need to make a wallet
					console.log('time for new wallet creation');
					this.showInitModal();
				}
				else{
					$('#walletInitModal').hide();
				}

				if(data.height != chainData.height && !chainData.synced){
					this.showErrorModal('You cannot create or import a new wallet during sync. <br />Chain: '+chainData.height+' synced: '+chainData.synced+', Wallet: '+data.height+'.');
				}

			});
		})*/
		
		$('#walletInitModal .closeModal').off('click').on('click',()=>{
			console.log('hide');
			this.hide();
		})

	}
	getSiaPorts(){
		return new Promise((resolve,reject)=>{
			fetch('/api/sia/getPorts').then(d=>d.json()).then(data=>{
				resolve(data);
			})
		});
	}
	showSiaPortsModal(data){
		//todo validate ports against ports redlist
		if(typeof data.ip != "undefined"){
			$('.setPortsModal .welcomeBody .ip').html(data.ip);
		}

		$('.setPortsModal').addClass('showing');
		$('.walletUtil').removeClass('showing');
		$('.setCustom input#useCustomPorts').off('change').on('change',()=>{

			const checked = $('input#useCustomPorts').is(':checked');
			console.log('custom ports changed',checked);
			if(checked){
				$('.setPortsModal #ports').show();
			}
			else{
				$('.setPortsModal #ports input').val('');
				$('.setPortsModal #ports').hide();
			}
		})
		$('#walletInitModal').show();

		$('.setPortsModal #savePorts').off('click').on('click',()=>{
			//validate redlist
			const rpcPort = $('#ports #rpcPort').val() == '' ? '9981' : $('#ports #rpcPort').val();
			const hostPort = $('#ports #hostPort').val() == '' ? '9982' : $('#ports #hostPort').val();
			const muxPort = $('#ports #muxPort').val() == '' ? '9983' : $('#ports #muxPort').val();
			const muxWSPort = $('#ports #muxWSPort').val() == '' ? '9984' : $('#ports #muxWSPort').val();
			const portsIndex = {};
			portsIndex[rpcPort] = '#rpcPort';
			portsIndex[hostPort] = '#hostPort';
			portsIndex[muxPort] = '#muxPort';
			portsIndex[muxWSPort] = '#muxWSPort';
			let hasValidationErrors = false;
			$('#ports .validation.error').remove();
			if(typeof data.redlist != "undefined"){
				console.log('ports in',data.redlist);
				Object.keys(data.redlist.default).map(port=>{
					if(port.indexOf(':') == -1){
						//not a range
						if(typeof portsIndex[port] != "undefined"){
							//ERROR
							hasValidationErrors = true;
							$(`#ports ${portsIndex[port]}`).before('<div class="validation error">* reserved port</div>')
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
								$(`#ports ${portsIndex[p.toString()]}`).before('<div class="validation error">* reserved port ('+port+')</div>')
							}
						})
					}
				});
				Object.keys(data.redlist.custom).map(port=>{
					if(data.redlist.custom[port].service == "SC"){
						return; //dont care about SC
					}
					if(typeof portsIndex[port] != "undefined"){
						//ERROR
						hasValidationErrors = true;
						$(`#ports ${portsIndex[port]}`).before('<div class="validation error">* reserved port</div>')
					}
				})
			}
			if(hasValidationErrors){
				return;
			}
			//done validating
			
			if($('.setPortsModal #savePorts').hasClass('cancel')){
				//already saving
				return;
			}
			
			const out = {
				rpc:rpcPort,
				host:hostPort,
				mux:muxPort,
				muxWS:muxWSPort
			};
			$('.setPortsModal #savePorts .foreground, .setPortsModal #savePorts .background').html('Starting Sia...')
			$('.setPortsModal #savePorts').removeClass('save').addClass('cancel');
			fetch('/api/sia/setPorts',
			{
			    headers: {
			      'Accept': 'application/json',
			      'Content-Type': 'application/json'
			    },
			    method: "POST",
			    body: JSON.stringify(out)
			})
			.then((res)=>{ console.log('success'); return res.json(); }).then(data=>{
				console.log('res data',data);
				setTimeout(()=>{
					//give sia a few seconds to init
					$('.setPortsModal').removeClass('showing');
					$('#walletInitModal').hide();
					this.initWallet();
				},3000)
				
			})
			.catch((res)=>{ console.log('error submitting',res) })
		})
		
	}
	fetchChainAndWalletData(){
		return new Promise((resolve,reject)=>{
			fetch('/api/sia/getChainStatus').then(chainRes=>chainRes.json()).then(chainData=>{
				fetch('/api/sia/getWalletInfo').then(res=>res.json()).then(data=>{
					resolve({
						wallet:data,
						chain:chainData
					});
				});
			});
		});
	}
	checkPWMatch(){
		if($('#confirmPW').val() == ''){
			$('.pwErrorMessage').html('Encryption password cannot be blank.').show();
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
	showInitModal(chainIsSynced){
		const isSynced = chainIsSynced;
		if(typeof isSynced == "undefined"){
			isSynced = this.isChainSynced;
		}
		$('.walletUtil').addClass('showing');
		$('.noConfirmBadge').hide();
		$('.confirmBadge').hide();
		$('.pwErrorMessage').hide();
		$('#walletInitModal').show();
		$('.walletUtil #importWallet').removeClass('canSave');
		$('.walletUtil #importWallet .foreground, .walletUtil #importWallet .background').html('Import Wallet');
		if(!isSynced){
			$('.importNote').remove();
			$('.walletUtil #importWallet').after('<div class="importNote">Note: You cannot import a wallet during chain sync.</div>')
			$('.walletUtil #importWallet').removeClass('save').addClass('cancel');
		}
		else{	
			$('.importNote').remove();
			$('.walletUtil #importWallet').addClass('save').removeClass('cancel');
		}
		$('.walletUtil #createNewWallet').removeClass('isSubmitting');
		$('.walletUtil #createNewWallet .foreground, .walletUtil #createNewWallet .background').html('Create New Wallet');
		$('#confirmPW').off('change').on('change',()=>{
			const pwMatch = this.checkPWMatch();
			if(!pwMatch){
				return;
			}
		});
		$('.walletUtil input, .walletUtil textarea').off('keyup').on('keyup',(e)=>{
			if(e.keyCode == 13){
				//is enter
				$('.walletUtil input, .walletUtil textarea').blur();
				if($('.walletUtil #mnemonic').val() == ''){
					$('.walletUtil #createNewWallet').trigger('click');
				}
				else{
					$('.walletUtil #importWallet').trigger('click');
				}
			}
		});
		$('.walletUtil #createNewWallet').off('click').on('click',()=>{
			const pwMatch = this.checkPWMatch();
			if(!pwMatch){
				return;
			}
			if($('.walletUtil #createNewWallet').hasClass('isSubmitting')){
				return;
			}
			$('.walletUtil #createNewWallet').addClass('isSubmitting');
			$('.walletUtil #createNewWallet .foreground, .walletUtil #createNewWallet .background').html('Loading...');
			const formOutput = {
				pw:$('#encryptionPW').val(),
				import:false
			}
			//create wallet

			fetch("/api/sia/initWallet",
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
				$('.newWalletInfo #mnemonicOut').html(data.primaryseed)
				$('.newWalletInfo').addClass('showing');
				this.initMnemonicConfirmation();
			})
			.catch((res)=>{ console.log('error submitting',res) })
			
		});
		$('.walletUtil #importWallet').off('click').on('click',()=>{
			//show mnemonic textarea
			if(!isSynced){
				return;
			}
			const pwMatch = this.checkPWMatch();
			if(!pwMatch){
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
					let returnTimeout = setTimeout(()=>{
						//hopefully it's rescanning our wallet. check to be safe
						this.verifyImportFromSeed();
					},10000);
					const formOutput = {
						pw: $('#encryptionPW').val(),
						import:true,
						seed: $('.walletUtil #mnemonic').val()
					}
					//create wallet
					fetch("/api/sia/initWallet",
					{
					    headers: {
					      'Accept': 'application/json',
					      'Content-Type': 'application/json'
					    },
					    method: "POST",
					    body: JSON.stringify(formOutput)
					})
					.then((res)=>{ console.log('success'); return res.json(); }).then(data=>{
						clearTimeout(returnTimeout);
						console.log('success res data',data);
						if(typeof data.message != "undefined" && data.message.indexOf('error') >= 0){
							this.showErrorModal(data.message);
						}
					})
					.catch((res)=>{ clearTimeout(returnTimeout); console.log('error submitting',res) })
				}
			}
		})
		$('.walletUtil #mnemonic').off('input').on('input',()=>{
			let wordLen = $('.walletUtil #mnemonic').val().trim().split(' ').length;
			console.log('updated',wordLen);
			if(wordLen == 29 || wordLen == 28){
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
		this.handleVerifyModalHide();
	}
	verifyImportFromSeed(){
		$('.seedImportMessage .error').hide();
		$('.seedImportMessage .success').show();
		fetch('/api/sia/getWalletInfo').then(d=>d.json()).then(data=>{
			const isRescanning = data.rescanning;
			console.log('is wallet rescanning??',isRescanning);
			if(isRescanning){
				$('.walletUtil').removeClass('showing');
				$('.seedImportMessage').addClass('showing');
			}
		}).catch(error=>{
			//show some error message because the import didnt work...
			console.log('error doing seed import',error);
		});
		this.handleVerifyModalHide();

	}
	handleVerifyModalHide(){
		$('#importSeedMessageConf').off('click').on('click',()=>{
			$('#walletInitModal').hide();
			$('#confirmPW').val('');
			$('#encryptionPW').val('');
			$('textarea#mnemonic').val('');
			$('.walletUtil').addClass('showing');
			$('.seedImportMessage').removeClass('showing');
		})
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
}