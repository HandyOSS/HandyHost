export class AKTMarketplace{
	constructor(dashboardComponent){
		fetch('./uiFragments/akt/marketplace.html').then(res=>res.text()).then(fragment=>{
			$('body').append(fragment);
			this.initEvents();
		})
		this.orderLimit = 10;
		this.pageNow = 1;
		this.dashboard = dashboardComponent;
	}
	show(){
		$('#marketplace').show();
		this.fetchOrdersData();

	}
	hide(){
		$('#marketplace').hide();
	}
	initEvents(){
		const _this = this;
		$('#marketplace .ordersPanel .mainOption').off('click').on('click',function(){
			$('#marketplace .ordersPanel .mainOption').removeClass('selected');
			$(this).addClass('selected');
			const id = $(this).attr('id');
			_this.pageNow = 1; //reset to lowest.
			let label;
			switch(id){
				case 'orders':
					_this.fetchOrdersData();
					$('#marketplace .ordersPanel .subOptions').html('')
					label = 'Orders';
				break;
				case 'bids':
					_this.fetchBidsData();
					label = 'Bids';
					_this.renderSubOptions('bids');
				break;
				case 'leases':
					_this.fetchLeasesData();
					_this.renderSubOptions('leases');
					label = 'Leases'
				break;
			}
			_this.showLoading(label);
		})
	}
	renderSubOptions(type){
		const _this = this;
		const $el = $('#marketplace .ordersPanel .subOptions');
		$el.html('');
		let opts = {
			'All':'all',
			'Open':'open',
			'Active': 'active',
			'Closed': 'closed'
		};
		if(type == 'leases'){
			delete opts.Open;
		}

		Object.keys(opts).map(key=>{
			const val = opts[key];
			const selected = key == 'All' ? ' selected' : '';
			$el.append('<span class="subOption'+selected+'" id="'+val+'">'+key+'</span>')
		});
		$('.subOption',$el).off('click').on('click',function(){
			$('.subOption',$el).removeClass('selected');
			$(this).addClass('selected');
			_this.pageNow = 1; //reset to lowest.
			const id = $(this).attr('id') == 'all' ? undefined : $(this).attr('id');
			const label = $(this).text() + ' ' + (type == 'bids' ? 'Bids' : 'Leases');
			_this.showLoading(label);
			switch(type){
				case 'bids':
					_this.fetchBidsData(id);
				break;
				case 'leases':
					
					_this.fetchLeasesData(id);
				break;
			}
		});

	}
	fetchBidsData(bidsState){
		let queryParams = {
			page:this.pageNow,
			limit:this.orderLimit
		};
		if(typeof bidsState != "undefined"){
			queryParams.state = bidsState;
			this.lastBidsState = bidsState;
		}
		else{
			this.lastBidsState = undefined;
		}

		fetch("/api/akt/getMarketplaceBids",
			{
			    headers: {
			      'Accept': 'application/json',
			      'Content-Type': 'application/json'
			    },
			    method: "POST",
			    body: JSON.stringify(queryParams)
		})
		.then((res)=>{ console.log('success'); return res.json(); }).then(data=>{
			console.log('res data',data);
			this.renderBidsPanel(data);
		})
		.catch((res)=>{ console.log('error submitting',res) });
	}
	fetchLeasesData(leasesState){
		let queryParams = {
			page:this.pageNow,
			limit:this.orderLimit
		};
		if(typeof leasesState != "undefined"){
			queryParams.state = leasesState;
		}
		fetch("/api/akt/getMarketplaceLeases",
			{
			    headers: {
			      'Accept': 'application/json',
			      'Content-Type': 'application/json'
			    },
			    method: "POST",
			    body: JSON.stringify(queryParams)
		})
		.then((res)=>{ console.log('success'); return res.json(); }).then(data=>{
			console.log('res data',data);
			this.renderLeasesPanel(data);
		})
		.catch((res)=>{ console.log('error submitting',res) });
	}
	fetchOrdersData(){
		fetch("/api/akt/getMarketplaceOrders",
			{
			    headers: {
			      'Accept': 'application/json',
			      'Content-Type': 'application/json'
			    },
			    method: "POST",
			    body: JSON.stringify({page:this.pageNow,limit:this.orderLimit})
		})
		.then((res)=>{ console.log('success'); return res.json(); }).then(data=>{
			console.log('res data',data);
			this.renderOrdersPanel(data);
		})
		.catch((res)=>{ console.log('error submitting',res) });
	}
	getPagination$El(data){
		let prevPage = '',nextPage = '';
		let totalPages = Math.ceil(data.pagination.total/this.orderLimit);
		let selectElem = '<select>';
		for(let i=1;i<=totalPages;i++){
			let selected = i == this.pageNow ? ' selected="selected"' : ''
			selectElem += '<option value="'+i+'"'+selected+'>'+i+'</option>';
		}
		selectElem += '</select>';
		let pageSelect = totalPages == 1 ? '1' : selectElem;
		if(this.pageNow > 1){
			prevPage = '<span class="prevPage prevNextTri"></span>';
		}
		console.log('agenow',this.pageNow,totalPages,data.pagination.total);
		if(this.pageNow+1 <= totalPages){
			nextPage = '<span class="nextPage prevNextTri"></span>';
		}
		const $pagination = $(`<div class="pagination">
			Page ${pageSelect} of ${totalPages}
			${prevPage} ${nextPage}
		</div>`);
		return $pagination;
	}
	renderBidsPanel(data,isAllBidsForOrder,targetedBid){
		const $el = $('#marketplace .ordersPanel .data');
		if(data.bids.length == 0){
			$el.html('<div class="message">No Bids Found</div>')
			return;
		}
		if(data.error){
			$el.html('<div class="message">Error: '+data.error+'</div>')
			return;
		}
		
		const $pagination = this.getPagination$El(data);
		const $bids = $('<table cellspacing=0 />');
		const $header = $('<tr />');
		$header.append('<th>Status</th>')
		$header.append('<th>Price/block (uAKT)</th>')
		$header.append('<th>Escrow Deposit Amount (uAKT)</th>')
		$header.append('<th>Created At (height)</th>')

		$bids.append($header);

		data.bids.map(bid=>{

			let id,label,$links;

			if(isAllBidsForOrder){
				id = bid.bid.bid_id.provider;
				label = 'Provider: ';
				let providerID = targetedBid.bid.bid_id.provider;
				if(typeof providerID == "undefined" && typeof this.dashboard.aktStatus != "undefined"){
					providerID = this.dashboard.aktStatus.providerData.providerWalletAddress;
				}
				if(id == providerID){
					id = '<strong>me</strong>'
				}
				$links = '';
			} 
			else{
				id = bid.bid.bid_id.owner+'/'+bid.bid.bid_id.dseq+'/'+bid.bid.bid_id.gseq+'/'+bid.bid.bid_id.oseq;
				label = 'Order ID: ';
				$links = '<a class="seeAllBids akashLink">View All Bids</a> | <a class="cancelBid akashLink">Cancel My Bid</a>';
			}
			const $trid = $('<tr class="orderID" data-id="'+id+'" />');
			
			$trid.append('<td colspan="4">'+label+id+' <div class="bidOpts">'+$links+'</div></td>');
			$bids.append($trid);
			const $row = $('<tr data-id="'+id+'" />');
			$row.append(`<td>${bid.bid.state}</td>`)
			$row.append(`<td>${bid.bid.price.amount}</td>`)
			$row.append(`<td>${bid.escrow_account.balance.amount}</td>`)
			$row.append(`<td>${bid.bid.created_at}</td>`);
			$bids.append($row);
			$('.seeAllBids',$trid).off('click').on('click',()=>{
				//get all bids
				this.pageNow = 1; //reset to lowest.
				this.getAllBidsForOrder(bid);
				this.showLoading('All Bids');
			});
			$('.cancelBid',$trid).off('click').on('click',()=>{
				this.cancelBid(bid);
			});
		})
		$('tr',$bids).off('mouseenter').on('mouseenter',function(){
			$('tr',$bids).removeClass('highlighted');
			let id = $(this).attr('data-id');
			$('tr[data-id="'+id+'"]',$bids).addClass('highlighted');
		});
		$('tr',$bids).off('mouseleave').on('mouseleave',function(){
			$('tr',$bids).removeClass('highlighted');
		});
		
		$el.html($pagination);
		$el.append($bids);
		$el.append($pagination.clone());
		if(isAllBidsForOrder){
			let targetID = targetedBid.bid.bid_id.owner+'/'+targetedBid.bid.bid_id.dseq+'/'+targetedBid.bid.bid_id.gseq+'/'+targetedBid.bid.bid_id.oseq;
			$el.prepend('<div class="subtitle">All Bids for: '+targetID+'</div>')
		}

		$('.ordersPanel .pagination .nextPage').off('click').on('click',()=>{
			this.pageNow += 1;
			if(isAllBidsForOrder){
				this.getAllBidsForOrder(targetedBid);
			}
			else{
				this.fetchBidsData(this.lastBidsState);
			}
			this.showLoading('All Bids');
			
		})
		$('.ordersPanel .pagination .prevPage').off('click').on('click',()=>{
			this.pageNow -= 1;
			if(isAllBidsForOrder){
				this.getAllBidsForOrder(targetedBid);
			}
			else{
				this.fetchBidsData(this.lastBidsState);
			}
			this.showLoading('All Bids');
			
		})
		$('.ordersPanel .pagination select').off('change').on('change',()=>{
			const val = $('.ordersPanel .pagination select option:selected').val();
			this.pageNow = parseInt(val);
			if(isAllBidsForOrder){
				this.getAllBidsForOrder(targetedBid);
			}
			else{
				this.fetchBidsData(this.lastBidsState);
			}
			this.showLoading('All Bids');
		})
		/*
		[
    {
        "bid": {
            "bid_id": {
                "owner": "akash1fnc04mjln6y0y7qgkkz9nwkjane50nnjxq32yf",
                "dseq": "1887409",
                "gseq": 1,
                "oseq": 1,
                "provider": "akash1mqnj2euks0aq82q0f2tknz6kua6zdfn97kmvhj"
            },
            "state": "open",
            "price": {
                "denom": "uakt",
                "amount": "2"
            },
            "created_at": "1887499"
        },
        "escrow_account": {
            "id": {
                "scope": "bid",
                "xid": "akash1fnc04mjln6y0y7qgkkz9nwkjane50nnjxq32yf/1887409/1/1/akash1mqnj2euks0aq82q0f2tknz6kua6zdfn97kmvhj"
            },
            "owner": "akash1mqnj2euks0aq82q0f2tknz6kua6zdfn97kmvhj",
            "state": "open",
            "balance": {
                "denom": "uakt",
                "amount": "50000000"
            },
            "transferred": {
                "denom": "uakt",
                "amount": "0"
            },
            "settled_at": "1887499"
        }
    }
]
		*/
	}
	getAllBidsForOrder(bid){
		const params = {
			limit:this.orderLimit,
			page:this.pageNow
		}
		fetch('/api/akt/fetchAllOrderBids',
			{
			    headers: {
			      'Accept': 'application/json',
			      'Content-Type': 'application/json'
			    },
			    method: "POST",
			    body: JSON.stringify({bid,params})
			})
			.then((res)=>{ console.log('success'); return res.json(); }).then(data=>{
				console.log('res data',data);
				if(data.error){
					$('#marketplaceModal').show();
					this.showErrorModal(data.message);
				}
				else{
					this.renderBidsPanel(data,true,bid);
				}
			
			})
			.catch((res)=>{ console.log('error submitting',res) });
	}
	cancelBid(bid){
		/*
		const args = [
			'./cancelBid.sh',
			params.pw,
			params.orderData.order_id.dseq,
			params.orderData.order_id.gseq,
			params.orderData.order_id.oseq,
			'10000uakt',
			walletName,
			params.orderData.order_id.owner
		]
		*/
		const orderData = {
			//re-create what we need to cancel this tx
			order_id:bid.bid.bid_id
		}
		this.showBidModal(orderData,'cancel');
	}
	renderLeasesPanel(data){
		const $el = $('#marketplace .ordersPanel .data');
		if(data.leases.length == 0){
			$el.html('<div class="message">No Leases Found</div>')
			return;
		}
		if(data.error){
			$el.html('<div class="message">Error: '+data.error+'</div>')
			return;
		}
		const $pagination = this.getPagination$El(data);

	}
	renderOrdersPanel(data){
		const $el = $('#marketplace .ordersPanel .data');
		if(data.error){
			$el.html('<div class="message">Error: '+data.error+'</div>')
			return;
		}
		const $pagination = this.getPagination$El(data);

		const $orders = $('<table cellspacing="0" />')
		const $header = $('<tr />')
		$header.append('<th>Price (uAKT/Block)</th>');
		$header.append('<th>Machine Count</th>');
		$header.append('<th>milli-CPU</th>');
		$header.append('<th>Memory (MB)</th>');
		$header.append('<th>Storage (MB)</th>');
		$header.append('<th>Endpoints</th>');
		$orders.append($header);
		data.orders.map(order=>{
			const $tr = $('<tr class="orderID" />');
			const longID = 'order_' + order.order_id.owner + '_' + order.order_id.dseq; 
			$tr.attr('data-id',longID);
			let shortenedID = order.order_id.owner;
			shortenedID = (shortenedID.slice(0,10) + '...' + shortenedID.slice(-8));
			$tr.append('<td colspan="6">Order: '+shortenedID+'/'+order.order_id.dseq+'/'+order.order_id.oseq+'/'+order.order_id.gseq+' <div class="bidOpts"><a class="seeAllBids akashLink">View All Bids</a> | <a class="placeBid akashLink">Place Bid</a></div></td>')
			$('a.placeBid',$tr).off('click').on('click',()=>{
				this.showBidModal(order);
			})
			$('a.seeAllBids',$tr).off('click').on('click',()=>{
				const bidData = {
					//this is an order so create what the query wants with the order_id data
					bid:{
						bid_id:order.order_id
					}
				};
				this.pageNow = 1; //reset to lowest.
				this.getAllBidsForOrder(bidData);
				this.showLoading('All Bids');
			})
			$orders.append($tr);
			order.spec.resources.map(resource=>{
				const $res = $('<tr />');
				$res.attr('data-id',longID);
				let endpointsFormatted = resource.resources.endpoints.map((e,i)=>{
					return `<div>${(i+1)}.${e.kind}</div>`;
				})
				$res.append(`<td>${resource.price.amount} ${resource.price.denom.toUpperCase()}</td>`)
				$res.append(`<td>${resource.count}</td>`);
				$res.append(`<td>${resource.resources.cpu.units.val}m</td>`);
				$res.append(`<td>${numeral(resource.resources.memory.quantity.val).format('0.00b').toUpperCase()}</td>`);
				$res.append(`<td>${numeral(resource.resources.storage.quantity.val).format('0.00b').toUpperCase()}</td>`);
				$res.append(`<td>${endpointsFormatted.join('')}</td>`);
				
				$orders.append($res);
			})

			
		})
		$('tr',$orders).off('mouseenter').on('mouseenter',function(){
			$('tr',$orders).removeClass('highlighted');
			let id = $(this).attr('data-id');
			$('tr[data-id="'+id+'"]',$orders).addClass('highlighted');
		});
		$('tr',$orders).off('mouseleave').on('mouseleave',function(){
			$('tr',$orders).removeClass('highlighted');
		});
		
		$el.html($pagination.clone());
		$el.append($orders);
		$el.append($pagination);
		//pagination
		$('.ordersPanel .pagination .nextPage').off('click').on('click',()=>{
			this.pageNow += 1;
			this.fetchOrdersData();
			this.showLoading('Orders');
			
		})
		$('.ordersPanel .pagination .prevPage').off('click').on('click',()=>{
			this.pageNow -= 1;
			this.fetchOrdersData();
			this.showLoading('Orders');
			
		})
		$('.ordersPanel .pagination select').off('change').on('change',()=>{
			const val = $('.ordersPanel .pagination select option:selected').val();
			this.pageNow = parseInt(val);
			this.fetchOrdersData();
			this.showLoading('Orders');
		})


	}
	showLoading(label){
		$('.ordersPanel .data').html(`
			<div class="loadingPanel">
				<div class="lds-roller"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
				<div class="loadingMessage">Querying ${label}...</div>
			</div>
		`)
		$('.ordersPanel .pagination').hide();
	}
	


	hideModal(){
		$('.walletModalContent').removeClass('showing');
		$('#marketplaceModal').hide();
		$('#marketplacePW').val('');
		$('.walletUtil').addClass('showing');
	}
	showBidModal(orderData,mode){
		$('#closeBidModal').off('click').on('click',()=>{
			this.hideModal();
		})
		let label = 'Place Bid';
		if(mode == 'cancel'){
			label = 'Cancel Bid';
			$('.bidPrice').hide();
			$('.bidDeposit').hide();
		}
		else{
			$('#price').val('');
			$('.bidDeposit').show();
			$('.bidPrice').show();
		}
		$('#marketplaceBidSave .foreground').html(label);
		$('#marketplaceBidSave .background').html(label);
		$('#marketplaceModal').show();
		$('.walletModalContent').removeClass('showing');
		$('.marketplaceBidModal').addClass('showing');
		
		$('#marketplaceBidSave').off('click').on('click',()=>{
			let waitLabel = 'Submitting Bid...';
			if(mode == 'cancel'){
				waitLabel = 'Submitting Cancel...';
			}
			$('#marketplaceBidSave .foreground').html(waitLabel);
			$('#marketplaceBidSave .background').html(waitLabel);
			
			const bidData = {
				pw:$('#marketplacePW').val(),
				price:$('#price').val(),
				deposit:$('#deposit').val(),
				orderData
			};
			let endpoint = 'createBid';
			if(mode == 'cancel'){
				endpoint = 'cancelBid';
			}
			fetch("/api/akt/"+endpoint,
			{
			    headers: {
			      'Accept': 'application/json',
			      'Content-Type': 'application/json'
			    },
			    method: "POST",
			    body: JSON.stringify(bidData)
			})
			.then((res)=>{ console.log('success'); return res.json(); }).then(data=>{
				console.log('res data',data);
				if(data.error){
					this.showErrorModal(data.message);
				}
				else{
					let msg = data.message;
					if(typeof msg == "undefined"){
						msg = 'Placed Bid Successfully!';
					}
					this.verifyRun(msg);
				}
				$('#marketplaceBidSave .foreground').html(label);
				$('#marketplaceBidSave .background').html(label);
			
			})
			.catch((res)=>{ console.log('error submitting',res) });
		})
		$('#cancelMarketplaceBid').off('click').on('click',()=>{
			this.hideModal();
		})
		
	}
	showErrorModal(message){
		$('.marketplaceMessage .error').html('ERROR: '+message);
		$('.marketplaceMessage .error').show();
		$('.marketplaceMessage .success').hide();
		$('.marketplaceBidModal').removeClass('showing');
		$('.marketplaceMessage').addClass('showing');
		this.handleVerifyModalHide(true);
	}
	verifyRun(message){
		console.log('verify data',message);
		//$('.messageText').html('a wallet aaddress')
		$('.marketplaceMessage .success .messageText').html(message);
		
		$('.marketplaceMessage .error').hide();
		$('.marketplaceMessage .success').show();
		$('.marketplaceBidModal').removeClass('showing');
		$('.marketplaceMessage').addClass('showing');
		this.clusterStatus.fetchStats();
		this.handleVerifyModalHide();

	}
	handleVerifyModalHide(wasError){
		$('#marketplaceMessageConf').off('click').on('click',()=>{
			this.hideModal()
			/*if(wasError){
				//this.showRunProviderModal();
				//leave it hidden
			}
			else{
				this.clusterStatus.fetchStats();
			}*/
		})
	}
}
/*
{
    "order_id": {
        "owner": "akash102psmnxzlqcuaajg0acls3asqghpt20s62h3ul",
        "dseq": "1301107",
        "gseq": 1,
        "oseq": 1
    },
    "state": "active",
    "spec": {
        "name": "westcoast",
        "requirements": {
            "signed_by": {
                "all_of": [],
                "any_of": [
                    "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63"
                ]
            },
            "attributes": [
                {
                    "key": "host",
                    "value": "akash"
                }
            ]
        },
        "resources": [
            {
                "resources": {
                    "cpu": {
                        "units": {
                            "val": "100"
                        },
                        "attributes": []
                    },
                    "memory": {
                        "quantity": {
                            "val": "536870912"
                        },
                        "attributes": []
                    },
                    "storage": {
                        "quantity": {
                            "val": "536870912"
                        },
                        "attributes": []
                    },
                    "endpoints": [
                        {
                            "kind": "SHARED_HTTP"
                        }
                    ]
                },
                "count": 1,
                "price": {
                    "denom": "uakt",
                    "amount": "1000"
                }
            }
        ]
    },
    "created_at": "1301109"
}
*/