import {siacoinsToHastings, hastingsToSiacoins} from './siaUtils.js';
export class SiaWalletInfo{
	constructor(){
		fetch('./uiFragments/sia/walletInfo.html').then(res=>res.text()).then(fragment=>{
			$('body').append(fragment);
			this.getWalletData();
		})
		
	}
	show(){
		this.getWalletData().then(()=>{
			$('#siaWalletInfo').show();
			this.resize();
		})
		
	}
	hide(){
		$('#siaWalletInfo').hide();
	}
	getWalletData(){
		return new Promise((resolve,reject)=>{
			fetch('/api/sia/getChainStatus').then(chain=>chain.json()).then(chainData=>{
				fetch('/api/sia/getWalletInfo').then(res=>res.json()).then(data=>{
					fetch('/api/sia/getHostMetrics').then(d=>d.json()).then(metrics=>{

						let lockedStorageAmount = 0;
						if(typeof metrics.financialmetrics != "undefined"){
							if(typeof metrics.financialmetrics.lockedstoragecollateral != "undefined"){
								lockedStorageAmount = hastingsToSiacoins(metrics.financialmetrics.lockedstoragecollateral).toNumber();
							}
						}
						console.log('got wallet data',data);
						if(data.encrypted && data.unlocked){
							fetch('/api/sia/getWalletAddress').then(addres=>addres.json()).then(addressJSON=>{
								//console.log('got address',addressJSON)
								this.populateUI(data,addressJSON.address,chainData,lockedStorageAmount);
								resolve();
							})
						}
						else if(!data.encrypted && !data.rescanning && !data.unlocked && data.height == 0){
							this.showEmptyUI(data);
							resolve();
						}
						else if(data.rescanning){
							//is a new wallet from seed, display a message
							this.showRescanUI(data);
							resolve();
						}
					});
					this.setSyncedStatus(data.height,chainData.height,chainData.synced);
				});
			});
		});
	}
	showRescanUI(walletData){
		const $warningMessage = $(`
			<div class="syncWarning">
				<div class="logo">
					<img src="./img/SiacoinSCLogo.svg" />
				</div>
				<div class="message">
					Your imported wallet is currently syncing. Once wallet data is present, this panel will show information about the wallet state.
				</div>
			</div>`)
		$('#siaWalletInfo .walletOptions').html($warningMessage);
	}
	showEmptyUI(walletData){
		const $warningMessage = $(`
			<div class="syncWarning">
				<div class="logo">
					<img src="./img/SiacoinSCLogo.svg" />
				</div>
				<div class="message">
					Either you just started re-scanning, or you need to add or import a new wallet.
					<br />
					Once wallet data is present, this panel will show information about the wallet state.
				</div>
			</div>`)
		$('#siaWalletInfo .walletOptions').html($warningMessage);
	}
	setSyncedStatus(walletHeight,chainHeight,isChainSynced){
		const isWalletSynced = chainHeight == walletHeight;
		let $synced;
		if(isChainSynced){
			$synced = $('<div class="syncedStatus">Synced: <span class="emoji">'+(isWalletSynced ? '✅' : '😞')+'</span> <small>[ '+walletHeight+' / '+chainHeight+' ]</small></div>')
		}
		else{
			$synced = $('<div class="syncedStatus">Synced: <span class="emoji">'+(isChainSynced ? '✅' : '😞')+'</span> <small>[ '+chainHeight+' / <span class="chainH">------</span> ]</small></div>')
		}
		console.log('set synced status',chainHeight,isChainSynced);
		
		$('#siaWalletInfo .syncedStatus').remove();
		$('#siaWalletInfo').append($synced);
		$('#siaMain .syncedStatus').remove();
		$('#siaMain').append($synced.clone());
		if(!isChainSynced){
			if(typeof this.lastUpdateCount == "undefined"){
				this.lastUpdateCount = 0;
				updateHeight();
			}
			this.lastUpdateCount += 1;
			if(this.lastUpdateCount == 10){
				updateHeight();
				this.lastUpdateCount = 1;
			}
			else{
				if(typeof this.consensusHeight != "undefined"){
					$('.syncedStatus .chainH').html(this.consensusHeight);
				}
			}
		}
		const _this = this;
		function updateHeight(){
			const url = 'https://siastats.info:3500/navigator-api/status';
			fetch(url).then(d=>d.json()).then(data=>{
				const height = data[0].consensusblock;
				_this.consensusHeight = height;
				$('.syncedStatus .chainH').html(height);
			})
		}
	}
	populateUI(walletData,address,chainData,lockedBalance){
		console.log('populate',walletData,address,chainData);
		const $ul = $('<ul></ul>');
		const $balanceArea = $('<div class="balanceInfo"></div>')
		const $confirmedBalance = $('<div class="balance balanceElement"><span class="balanceLabel">Balance:</span> <span class="balanceValue">'+Math.floor(hastingsToSiacoins(walletData.confirmedsiacoinbalance)*100)/100+'</span><span class="balanceLabel balanceUnit"> SC</span></div>');
		const $lockedCollateralBalance = $('<div class="collateralbalance balanceElement"><span class="balanceLabel">Locked Collateral:</span> <span class="balanceValue">'+Math.floor(lockedBalance*100)/100+'</span><span class="balanceLabel balanceUnit"> SC</span></div>');
		const isChainSynced = chainData.synced;
		const isWalletSynced = chainData.height == walletData.height;
		
		
		
		const confVal = Math.floor((hastingsToSiacoins(walletData.unconfirmedincomingsiacoins) - hastingsToSiacoins(walletData.unconfirmedoutgoingsiacoins))*100)/100;
		let confColor = '#000';
		let confMark = '';
		let hasColorClass = '';
		let hasColor = ''
		if(confVal < 0){
			hasColorClass = ' hasColor';
			confColor = '#c00';
			confMark = '-';
		}
		if(confVal > 0){
			hasColor = ' hasColor';
			confColor = '#23db75';
			confMark = '+';
		}
		const $unconfirmed = $('<div class="unconfirmed balanceElement"><span class="balanceLabel">Unconfirmed:</span> <span class="balanceValue'+hasColorClass+hasColor+'" style="color:'+confColor+';">'+(confMark+confVal)+'</span><span class="balanceLabel balanceUnit"> SC</span></div>')
		
		const $address = $('<li class="address"><span class="icon"><img class="qrIcon" src="./img/qr-icon.png" /></span><span class="label">Receive SC</span></li>')
		const $send = $('<li class="send"><span class="icon"><img class="sendIcon" src="./img/send.png" /></span><span class="label">Send SC</span></li>')
		$ul.append($address);
		$ul.append($send);
		$balanceArea.append($confirmedBalance);
		$balanceArea.append($unconfirmed);
		$balanceArea.append($lockedCollateralBalance);

		this.setSyncedStatus(walletData.height,chainData.height,isChainSynced);

		$('#siaWalletInfo .walletOptions').html($ul);
		$('#siaWalletInfo .walletOptions').append($balanceArea);
		
		$address.off('click').on('click',()=>{
			const addr = address;
			fetch('/api/sia/getQRCode/'+addr).then(res=>res.json()).then(data=>{
				this.showQRModal(data.qr,addr)
			})
		});
		$send.off('click').on('click',()=>{
			this.showSendModal(hastingsToSiacoins(walletData.confirmedsiacoinbalance));
		});
		this.resize();
		$(window).off('resize').on('resize',()=>{
			this.resize();
		})
		this.fetchTransactions(isWalletSynced);
	}
	fetchTransactions(isWalletSynced){
		fetch('/api/sia/getRecentTransactions').then(res=>res.json()).then(data=>{
			/*data.map(rec=>{
				console.log('tx',rec);
			})*/
			//console.log('txes',data);
			$('.walletDataPanel').html($('<ul />'));
			
			if(data.unconfirmedtransactions != null){
				this.renderTransactions(data.unconfirmedtransactions,'unconfirmed');
			}
			if(data.confirmedtransactions != null){
				this.renderTransactions(data.confirmedtransactions,'confirmed');
			}

			if(data.unconfirmedtransactions == null && data.confirmedtransactions == null){
				//no transactions yet
				const $li = $('<li><span class="notxes">No Transactions Found</span></li>');
				if(!isWalletSynced){
					$li.append(' <small>[ wallet not synced yet ]</small>')
				}
				$('.walletDataPanel ul').html($li);
			}
		})
	}
	renderTransactions(txes,type){
		txes.sort((a,b)=>{
			return b.confirmationtimestamp - a.confirmationtimestamp;
		}).map((tx,txI)=>{
			let height = tx.confirmationheight;
			const timestamp = tx.confirmationtimestamp;
			let direction = tx.inputs[0].walletaddress ? 'out' : 'in';
			const id = tx.transactionid;
			let val = 0;
			let dirColor,dirMarker;
			let momentDate = moment(timestamp,'X').format('MMM DD, YYYY hh:mma');
			//console.log('tx type',type,txes);
			let isCollateralPosting = true;
			let isStorageProof = false;
			let isContractFormation = false;
			let isCollateralReturned = false;
			let allInputsAreMe = true;
			let allOutputsAreMe = true;
			let hasUpDownClass = '';
			tx.inputs.map(t=>{
				if(!t.walletaddress){
					isCollateralPosting = false;
				}
			})
			tx.outputs.map(t=>{
				if(!t.walletaddress){
					isCollateralPosting = false;
				}
			});
			//check if this is a returned collateral tx
			tx.inputs.map(t=>{
				if(!t.walletaddress){
					allInputsAreMe = false;
				}
			})
			tx.outputs.map(t=>{
				if(!t.walletaddress){
					allOutputsAreMe = false;
				}
			});
			if(allInputsAreMe && allOutputsAreMe){
				if(tx.transaction.filecontracts != null && tx.transaction.filecontractrevisions != null){
					if(tx.transaction.filecontracts.length == 0 && tx.transaction.filecontractrevisions.length == 0){
						//check to see if there area any synonym tx to reference
						let isParentID = false;
						let ids = [];
						tx.outputs.map(t=>{
							if(typeof t.parentid == "undefined"){
								isParentID = true;
								ids.push(t.id);
							}
						});
						if(isParentID){
							console.log('is parentID',txI,ids);
							let childTX = txes.find((child,childI)=>{
								if(child.inputs.length == ids.length){
									//console.log('potential match child tx',childI,child);
									let toreturn = true;
									child.inputs.map(input=>{
										
										if(ids.indexOf(input.parentid) == -1){
											toreturn = false;
										}
									});
									return toreturn;
								}
								return false;
							});
							console.log('childTX',childTX);
							if(childTX){
								if(childTX.transaction.filecontracts != null && childTX.transaction.filecontractrevisions != null){
									if(childTX.transaction.filecontracts.length == 0 && childTX.transaction.filecontractrevisions.length == 0){
										//this is retuned collateral
										direction = 'collateralReturned';
										isCollateralReturned = true;
										isCollateralPosting = false;
									}
								}
							}
						}
						

					}
				}
			}


			if(tx.transaction.filecontracts != null && tx.transaction.filecontractrevisions != null){
				if(tx.transaction.filecontracts.length > 0 || tx.transaction.filecontractrevisions.length > 0){
					isContractFormation = true;
					direction = 'contractFormation';
				}
			}
			if(tx.transaction.storageproofs != null){
				if(tx.transaction.storageproofs.length > 0){
					isStorageProof = true;
				}
			}
			if(isCollateralPosting){
				direction = 'collateralPosting';
				//console.log('collateral',tx);
			}
			
			if(direction == 'out'){
				hasUpDownClass = ' hasUpDownColor';
				dirMarker = '-';
				dirColor = '#c00';
				val = hastingsToSiacoins(tx.inputs[0].value).toNumber();
				tx.outputs.map(outtx=>{
					if(outtx.walletaddress && outtx.fundtype != 'miner fee'){
						val -= hastingsToSiacoins(outtx.value).toNumber();
					}
				});
				
			}
			if(direction == 'in'){
				hasUpDownClass = ' hasUpDownColor';
				dirMarker = '+';
				dirColor = '#23db75';
				tx.outputs.map(outtx=>{
					if(outtx.walletaddress){
						val = hastingsToSiacoins(outtx.value).toNumber();
					}
				})
			}
			if(direction == 'collateralPosting'){
				dirMarker = '(collateral) ';
				dirColor = '#333';
				val = 0;
				tx.outputs.map(output=>{
					val = hastingsToSiacoins(tx.outputs[0].value).toNumber();
				})
				

				//val += '<small>(collateral)</small>'
			}
			if(direction == 'contractFormation'){
				dirMarker = '(contract) ';
				dirColor = '#333';
				if(typeof tx.transaction.filecontracts[0] == "undefined"){
					val = numeral(tx.transaction.filecontractrevisions[0].filesize).format('0.0b');
				}
				else{
					val = numeral(tx.transaction.filecontracts[0].filesize).format('0.0b');
				}
				
				console.log('cf val',val);
			}
			if(direction == 'collateralReturned'){
				//this isnt actually collateral returned. It is a storage proof submittal
				dirMarker = '(submit storage proof) ';
				dirColor = '#333'
				val = hastingsToSiacoins(tx.outputs[0].value).toNumber();
			}
			/*if(direction == 'collateralReturned'){
				hasUpDownClass = ' hasUpDownColor';
				dirMarker = '(returned collateral) +';
				dirColor = '#23db75'
				val = hastingsToSiacoins(tx.outputs[0].value).toNumber();
			}*/

			if(val == 0){
				dirMarker = '';
				dirColor = '#333'
			}
			let SCLabel = ' SC';
			if(!isContractFormation){
				val = Math.floor(val*100)/100;
			}
			else{
				SCLabel = '';
			}
			if(isStorageProof){
				dirMarker = '(storage proof miner fee) -';
				//dirColor = '#333';
			}

			const $li = $('<li />')
			let $block = $('<span class="block txElem"><span class="label">Block:</span>'+height+'</span>');
			let $date = $('<span class="date txElem"><span class="label">Date:</span>'+momentDate+'</span>');
			const $txid = $('<span class="id txElem"><span class="label">txid:</span><a href="https://siastats.info/navigator?search='+id+'" target="_blank">'+id+'</a></span>');
			const $val = $('<div class="value'+hasUpDownClass+'" style="color:'+dirColor+'; border-color:'+dirColor+';">'+(dirMarker+val)+SCLabel+'</div>');
			const $leftPart = $('<div class="leftPart"></div>')
			if(type == 'unconfirmed'){
				$block = $('<span class="pending txElem">Pending...</span>')
				$date = $('')
			}
			$leftPart.append($block,$txid,$date);
			$li.append($leftPart,$val);
			
			$('.walletDataPanel ul').append($li);
		})
		this.resize();
	}
	resize(){
		let w = $('#siaWalletInfo').width();
		let h = $('#siaWalletInfo').height();
		let ulW = $('#siaWalletInfo .walletOptions ul').width();
		let optsData = $('#siaWalletInfo .walletOptions')[0].getBoundingClientRect();
		let balanceW = $('#siaWalletInfo .balanceInfo').width();
		let balanceH = $('#siaWalletInfo .balanceInfo').height();
		let optsH = optsData.height;
		let optsOffsetTop = optsData.top;

		$('#siaWalletInfo .walletData').css('height',h - (optsH+optsOffsetTop + 30));
		/*$('.balanceInfo').css({
			'margin-left':((w-ulW-balanceW)/2)+'px',
			'margin-top':((optsH-balanceH)/2)+'px'
		})*/

	}
	showSendModal(availBalanceSC){
		$('#sendModal input').val('');
		$('#sendModal').show();
		$('#sendModal .sendBody').addClass('showing');
		$('#sendModal .button.save#send').off('click').on('click',()=>{
			$('#sendModal #confirm').show();
			$('#sendModal #send').removeClass('save').addClass('cancel');
		})
		$('#sendModal textarea#toAddress').off('input').on('input',()=>{
			$('#sendModal textarea#toAddress').css('height','1px');
			const scrH = $('#sendModal textarea#toAddress')[0].scrollHeight
			$('#sendModal textarea#toAddress').css('height',(5+scrH)+"px");
		})
		$('#sendModal .button#confirm').off('click').on('click',()=>{
			//submit data
			//on confirmation: show confirm modal
			const toAddress = $('#sendModal textarea#toAddress').val();
			const scValue = $('#sendModal input#scValue').val();
			const encryptionPW = $('#sendModal input#scSendPass').val();
			$('#sendModal #confirm').hide();
			$('#sendModal .button#send').removeClass('cancel').addClass('save');
			//this.hideSendModal();

			//sendCoins(amountHastings,destination)
			const postData = {
				destination:toAddress,
				amount:siacoinsToHastings(scValue),
				pw:encryptionPW
			};
			fetch("/api/sia/sendSC",
			{
			    headers: {
			      'Accept': 'application/json',
			      'Content-Type': 'application/json'
			    },
			    method: "POST",
			    body: JSON.stringify(postData)
			})
			.then((res)=>{ console.log('success'); return res.json(); }).then(data=>{
				$('#sendModal textarea#toAddress').val('');
				$('#sendModal input#scValue').val('');
				$('#sendModal input#scSendPass').val('');
				
				console.log('sentSC res data',data);
				
				if(typeof data.message != "undefined"){
					this.showSendConfirmModal(data.message,toAddress,scValue,true);
				}
				else{
					this.showSendConfirmModal(data.transactionids[0],toAddress,scValue);
				}
				
			})
			.catch((res)=>{ console.log('error sending SC',res) })

			

		})
		$('#sendModal .button#cancel').off('click').on('click',()=>{
			this.hideSendModal();
		});
		$('#sendModal .sendMax').off('click').on('click',()=>{
			$('#sendModal input#scValue').val(availBalanceSC);
		})
		
	}
	showSendConfirmModal(tx,toAddr,scValue,hasError){
		$('#sendModal #toAddress').val('');
		$('#sendModal .sendBody').removeClass('showing');
		$('#sendModal .sendConfirm').addClass('showing');
		let $emojiGuy = $('#sendModal .messageIcon');
		let $ul = $('#sendModal .sendConfirm ul.sentInfo')
		//if confirmation
		let $li0 = $('<li>Success!</li>')
		let $li1 = $(`<li>TransactionID: <span class="txid">${tx}</span></li>`);
		let $li2 = $(`<li>Sent To: <span class="sentto">${toAddr}</span></li>`);
		let $li3 = $(`<li>Value: <span class="sentVal">${scValue} SC</span></li>`);
		$ul.html('');
		if(hasError){
			$emojiGuy.html('⚠️');
			$ul.append('<div class="error">ERROR: '+tx+'</div>')
		}
		else{
			$emojiGuy.html('🥳');
			$ul.append($li0,$li1,$li2,$li3);
		}
		
		$('.sendConfirm #doneConfirm').off('click').on('click',()=>{
			$('#sendModal').hide();
			$('#sendModal .sendConfirm').removeClass('showing');
			$('#sendModal .sendBody').addClass('showing');
			this.hideSendModal();
		})
	}
	hideSendModal(){
		$('#sendModal #confirm').hide();
		$('#sendModal .button#send').removeClass('cancel').addClass('save');
		$('#sendModal').hide();
	}
	showQRModal(qrString,address){
		$('#qrModal textarea').val(address);

		//$('#qrModal input').attr('size',address.length+3);
		$('#qrModal .qrBody img.qrImg').attr('src',qrString);
		$('#qrModal .button').off('click').on('click',()=>{
			$('#qrModal').hide();
		})
		$('#qrModal textarea').off('click').on('click',function(){
			$(this).focus();
			$(this).select();
		})
		$('#qrModal #refreshAddress').off('click').on('click',()=>{
			fetch('/api/sia/getNewWalletAddress').then(res=>res.json()).then(newAddr=>{
				fetch('/api/sia/getQRCode/'+newAddr.address).then(res=>res.json()).then(data=>{
					this.showQRModal(data.qr,newAddr.address)
				})
			})
		})
		$('#qrModal').show();

		$('#qrModal textarea').css('height','1px');
		const scrH = $('#qrModal textarea')[0].scrollHeight
		$('#qrModal textarea').css('height',(5+scrH)+"px");
	}
}