export class AKTClusterConfig{
	constructor($el,parentComponent){
		this.$el = $el;
		this.parentComponent = parentComponent;
		this.ansi_up = new AnsiUp();
		this.fetchData();
		this.initBuildABox();
		
	}
	fetchData(){
		fetch('/api/akt/getClusterConfig').then(d=>d.json()).then(json=>{
			console.log('cluster config',json);
			this.renderClusterConfig(json);
			this.activateSaveButton();
		})
	}
	renderClusterConfig(configData){
		
		//render nodes
		this.renderNodes(configData);
		this.initProviderDetails(configData);

	}
	renderNodes(configData,isPostFetchNodes){
		this.configData = configData;
		const $ul = $('ul.topLevel',this.$el);
		let canConfigureKubernetes = false;
		if(typeof configData.nodes == "undefined"){

			$ul.html('<li>No Cluster Nodes Found.</li>')
			

		}
		else{
			let hasSelectedNodes = false;
			let canConfigureDisk = false;
			configData.nodes.map(node=>{
				if(node.selected){
					hasSelectedNodes = true;
				}
				if(node.sshConfigured){
					canConfigureDisk = true;
					canConfigureKubernetes = true;
				}
			})
			const $table = $('<table></table>');
			const $header = $('<tr />');
			$header.append('<th>Select</th>')
			$header.append('<th>Hostname</th>')
			$header.append('<th>IP</th>')
			$header.append('<th>MAC Address</th>')
			$header.append('<th>Manufacturer</th>')
			if(hasSelectedNodes){
				$header.append('<th>SSH Configured?</th>')
			}
			/*if(canConfigureDisk){
				$header.append('<th>Mount USB3 Disk?</th>')
			}*/
			
			$table.append($header);
			configData.nodes.map(node=>{

				let configured = node.sshConfigured ? '<span class="emoji">👍</span>' : isPostFetchNodes ? '' : '<a>Setup SSH Access</a>';
				let needsDisk = node.sshConfigured ? (node.diskConfigured ? '<span class="emoji">👍</span>' : '<a>Add USB3 Disk</a>' ) : '';
				const $tr = $('<tr />');
				const selectedNode = node.selected ? ' checked="checked"' : "";
				console.log('selected',node);
				$tr.append('<td><input type="checkbox" name="selected"'+selectedNode+' value="'+node.mac+'" /></td>')
				$tr.append('<td>'+node.hostname+'</td>')
				$tr.append('<td>'+node.ip+'</td>')
				$tr.append('<td>'+node.mac+'</td>')
				$tr.append('<td>'+node.manufacturer+'</td>')
				if(hasSelectedNodes){
					const $configSSH = $('<td>'+configured+'</td>');
					$tr.append($configSSH)

					$('a',$configSSH).off('click').on('click',()=>{
						//show ssh password modal
						this.parentComponent.showSSHSetupModal(node);
					})
				}
				/*if(canConfigureDisk){
					const $addDisk = $('<td>'+needsDisk+'</td>')
					$tr.append($addDisk);
					$('a',$addDisk).off('click').on('click',()=>{
						this.parentComponent.showAddDiskModal(node);
					})
				}*/

				$table.append($tr);
			})
			$ul.html($table);
		}
		let msg = isPostFetchNodes ? 'Dont see your nodes? <a>Try scanning again</a>' : '<a>Fetch Local Node List</a>';
		const $li = $('<li>'+msg+'</li>')
		$ul.append($li)
		$li.off('click').on('click',()=>{
			if($li.hasClass('loading')){
				return;
			}
			$li.html('Querying Network... (this may take a minute)');
			fetch('/api/akt/getHosts').then(d=>d.json()).then(json=>{

				json.map(node=>{
					if(typeof node.selected == "undefined"){
						node.selected = false;
					}
					if(typeof node.sshConfigured == "undefined"){
						node.sshConfigured = false;
					}
					/*if(typeof node.partitionsConfigured == "undefined"){
						node.partitionsConfigured = false;
					}*/
				})
				this.renderNodes({nodes:json},true)

				
			})
			$li.addClass('loading');

		})
		if(canConfigureKubernetes){
			$('#initCluster').removeClass('cancel').addClass('save');
			let k8sConfigEnhanced = this.autoConfigureK8sData(configData);
			this.renderKubernetesConfig(configData);
			$('.advancedOptions a').off('click').on('click',()=>{
				$('#clusterInventory').show();
			})
		}
	}
	autoConfigureK8sData(configData){
		let hasMaster = false;
		let hasEtcd = false;

		configData.nodes.map(node=>{
			if(typeof node.kubernetes != "undefined"){
				if(node.kubernetes.role == 'master'){
					hasMaster = true;
				}
				if(node.kubernetes.role == 'etcd'){
					hasEtcd = true;
				}
			}
		})
		const modified = configData.nodes.map(node=>{
			if(typeof node.kubernetes == "undefined"){
				let myRole = 'none';
				if(!hasMaster){
					myRole = 'master';
					hasMaster = true;
				}
				if(myRole == 'none' && !hasEtcd){
					myRole = 'etcd';
					hasEtcd = true;
				}
				node.kubernetes = {
					role:myRole,
					isCompute:true,
					name:node.hostname.replace('.local','')
				}
			}
			return node;
		});
		return modified;
	}
	showQuestionPopup(questionID){
		let title = '';
		let body = '';
		switch(questionID){
			case 'roleAnswer':
				title = 'Cluster Role:';
				body = 'Use at least one master node and one etcd for a small (2-4 node) cluster.';
			break;
			case 'computeAnswer':
				title = 'Compute Nodes:';
				body = 'In a 2-4 node cluster, set all nodes to compute. In a larger cluster, use your master node primarily as a load balancer and not for compute.';
			break;
		}
		$('#answerPopup .title').html(title);
		$('#answerPopup .answer').html(body);
		const pos = $('.question#'+questionID).offset();
		const parentPos = $('.question#'+questionID).offsetParent().offset();
		const left = pos.left - parentPos.left;
		$('#answerPopup').css({
			left: left,
			top: pos.top - ($('#answerPopup').height()+20)
		}).show();
	}
	renderKubernetesConfig(configData){
		const _this = this;
		//$('#clusterInventory').show();
		const $el = $('#clusterInventory .configData');
		const $table = $('<table></table>');
		$el.html($table);
		let $header = $('<tr class="header" />')
		$header.append('<th>Hostname</th>');
		$header.append('<th>IP</th>');
		$header.append('<th>Node Name</th>');
		$header.append('<th>Cluster Role <div class="question" id="roleAnswer">?</div></th>');
		$header.append('<th>Is Compute Node <div class="question" id="computeAnswer">?</div></th>');
		$table.append($header);
		$('.question',$header).off('mouseenter').on('mouseenter',function(){
			_this.showQuestionPopup($(this).attr('id'));
		}).off('mouseleave').on('mouseleave',()=>{
			$('#answerPopup').hide();
		})
		configData.nodes.map(node=>{
			if(!node.selected){
				return;
			}
			let k8nName = '';
			let k8nRole = '';
			let isCompute = false;
			const $k8nRoleSelect = $('<select class="role" />');
			$k8nRoleSelect.append('<option value="none">none</option>');
			$k8nRoleSelect.append('<option value="master">Master Node</option>');
			$k8nRoleSelect.append('<option value="etcd">etcd</option>');

			const $isComputeCheckbox = $('<input type="checkbox" class="isCompute" />')

			if(typeof node.kubernetes != "undefined"){
				k8nName = node.kubernetes.name;
				k8nRole = node.kubernetes.role;
				isCompute = node.kubernetes.isCompute;
				$('option[value="'+k8nRole+'"]',$k8nRoleSelect).attr('selected','selected');
				if(isCompute){
					$isComputeCheckbox.attr('checked','checked');
				}
			}
			const $tr = $('<tr />');
			$tr.append(`<td>${node.hostname}</td>`);
			$tr.append(`<td class="ip">${node.ip}</td>`);
			$tr.append(`<td><input class="nodename" type="text" placeholder="Short Name ie: akash0" value="${k8nName}" /></td>`)
			const $sel = $('<td />');
			$sel.append($k8nRoleSelect);
			$tr.append($sel);
			const $comp = $('<td />');
			$comp.append($isComputeCheckbox);
			$tr.append($comp)
			$table.append($tr);
		})
		$('#initCluster').off('click').on('click',()=>{
			if(!confirm('If there is currently a kubernetes cluster, this operation will completely remove it. Still Continue?')){
				console.log('aborted');
				return;
			}
			let configOut = JSON.parse(JSON.stringify(configData));
			configOut.nodes = configOut.nodes.filter(n=>{
				return n.selected;
			})
			$('tr:not(.header)').each(function(){
				const name = $('input.nodename',$(this)).val();
				const role = $('select option:selected',$(this)).val();
				const isCompute = $('input[type="checkbox"]',$(this)).is(':checked');
				const ip = $('td.ip',$(this)).html();
				configOut.nodes.map(node=>{
					if(node.ip == ip){
						node.kubernetes = {
							name,
							role,
							isCompute
						}
					}
				});
				
			})
			fetch("/api/akt/generateKubernetesInventory",
			{
			    headers: {
			      'Accept': 'application/json',
			      'Content-Type': 'application/json'
			    },
			    method: "POST",
			    body: JSON.stringify(configOut)
			})
			.then((res)=>{ return res.json(); }).then(data=>{
				
				console.log('result',data);
				this.initLogs();
			})
			.catch((res)=>{ 
				console.log("error",res);

			});
		})
	}
	initLogs(){
		$('#logs').addClass('showing');
		$('#logs .logsMessage').html('Kubernetes cluster build is running, it will take at least 5-10 minutes...')
	}
	updateLogs(message,showTimestamp){
		if(typeof this.logs == "undefined"){
			this.logs = []
			$('.logs pre').html('');
		}
		this.logs.push(message);
		if(this.logs.length > 500){
			this.logs = this.logs.slice(-300);
			//redraw all logs
			$('.logs pre').html('')
			this.logs.map(line=>{
				$('.logs pre').append(line);
			})
		}
		else{
			/*let timestring = `<em style="color: yellow;">[${moment().format('MM-DD hh:mm:ssA')}]</em> `;
			if(showTimestamp === false){
				timestring = '';
			}*/
			$('.logs pre').append(this.ansi_up.ansi_to_html(message))
		}
		if($('.logs pre').height() > $('.logs').height()){
			const diff = $('.logs pre').height() - $('.logs').height();
			$('.logs').scrollTop(diff);
		}


	}
	validateConfig(configData){
		let canContinue = true;
		let needsErrorMessage = {};
		Object.keys(configData.provider).map(key=>{
			const val = configData.provider[key];
			if(val == ''){
				needsErrorMessage[key] = true;
				canContinue = false;
				$('.provider_'+key).addClass('hasError');
			}
			else{
				$('.provider_'+key).removeClass('hasError');
			}
		});

		return canContinue;
	}
	activateSaveButton(){
		const _this = this;
		$('#saveNodeConfigs').off('click').on('click',()=>{
			const output = {nodes:[],provider:{}};
			$('.topLevel input[type="checkbox"]',this.$el).each(function(){
				if($(this).is(':checked')){
					const val = $(this).val();
					const nodeData = _this.configData.nodes.find(node=>{
						return node.mac == val;
					});
					nodeData.selected = true;
					output.nodes.push(nodeData);

				}
			})
			const providerIP = $('#providerIP').val();
			const clusterIP = $('#clusterIP').val();
			const regionName = $('#regionName').val();
			const clusterName = $('#clusterName').val();
			const providerWalletName = $('#providerWalletName').val();
			const providerWalletAddress = $('#providerWalletAddress').val();
			output.provider = {
				providerIP,
				clusterIP,
				regionName,
				clusterName,
				providerWalletName,
				providerWalletAddress
			}
			const continueSubmission = this.validateConfig(output);
			if(!continueSubmission){
				return false;
			}
			console.log('to save',output);
			
			fetch("/api/akt/saveClusterConfig",
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
				this.fetchData();
				$('.walletUtil').removeClass('showing');
				$('#walletInitModal').show();
				this.parentComponent.verifyImportFromSeed('Saved Cluster Config!');

			})
			.catch((res)=>{ 
				$('.walletUtil').removeClass('showing');
				$('#walletInitModal').show();
				this.parentComponent.showErrorModal('Error: '+res); 
				console.log('error submitting',res);

			});

		});
		$('#nodeConfigInfo #cancel').off('click').on('click',()=>{
			this.fetchData();
		})
	}
	//build a box!
	initBuildABox(){
		$('a#buildLink').off('click').on('click',()=>{
			this.parentComponent.showBuildABoxModal();
		});
		$('#buildABoxModal .step').off('click').on('click',function(){
			const id = $(this).attr('data-id');
			console.log('clicked',id,$('.stepInfo#'+id).is(':visible'))
			if($('.stepInfo#'+id).is(':visible')){
				$('.stepInfo#'+id).hide();
			}
			else{
				$('.stepInfo#'+id).show();
			}
		})
		$('#chooseDevice').off('click').on('click',()=>{
			fetch('/api/akt/getUbuntuUSBDisks').then(d=>d.json()).then(r=>{
				if(typeof r.error != "undefined"){
					$('.chooseDeviceResult').html('<div class="usbError">'+r.error+'</div>');
				}
				else{
					const $select = $('<select class="styledSelect" id="usbDevice"></select>')
					r.map(usb=>{
						const $option = $('<option value="'+usb.mountPoint+'">'+usb.meta.model+' - '+usb.meta.size+'</option>')
						$select.append($option);
					})
					$('.chooseDeviceResult').html($select);
					if($('#usbDevice option:selected').length > 0 && $('#setHostname').val().length > 0){
						$('#finishHost').removeClass('nonActive');
					}
					else{
						$('#finishHost').addClass('active');
					}
				}
			})
		})
		$('#setHostname').off('keyup change').on('keyup change',()=>{
			let val = $('#setHostname').val();
			val = val.replace(/[^a-z0-9]/gi,'').toLowerCase();
			$('#setHostname').val(val);
			if($('#usbDevice option:selected').length > 0 && val.length > 0){
				$('#finishHost').removeClass('nonActive');
			}
			else{
				$('#finishHost').addClass('active');
			}
		})
		$('#finishHost').off('click').on('click',()=>{
			const path = $('#usbDevice option:selected').val();
			const hostname = $('#setHostname').val();
			if($('#finishHost').hasClass('nonActive')){
				return;
			}
			$('#finishHost').html('Submitting...').addClass('nonActive');
			$('#autoConfig .error').hide();
			$('#autoConfig .confirmation').hide();
			if(typeof path != "undefined" && hostname != ''){
				//submit vals
				fetch("/api/akt/configureNVMe",
			{
			    headers: {
			      'Accept': 'application/json',
			      'Content-Type': 'application/json'
			    },
			    method: "POST",
			    body: JSON.stringify({path,hostname})
			})
			.then((res)=>{ console.log('success'); return res.json(); }).then(data=>{
				$('#finishHost').html('Configure NVMe');
				console.log('result',data);
				if(typeof data.error == "undefined"){
					$('#autoConfig .confirmation').show();
				}
				else{
					$('#autoConfig .error').html('ERROR: '+data.error).show();
				}
			})
			.catch((res)=>{ 
				console.log("error",res);

			});
			}
		});
	}
	initProviderDetails(config){
		/*fetch('/api/akt/getProviderDetail').then(d=>d.json()).then(d=>{
			console.log('provider detail');
		})*/
		if(typeof config.provider != "undefined"){
			Object.keys(config.provider).map(key=>{
				const val = config.provider[key];
				$('.providerList input#'+key).val(val);
			})
		}
		$('a.getGlobalIP').off('click').on('click',function(){
			const $this = $(this);
			fetch('/api/akt/getGlobalIP').then(d=>d.json()).then(d=>{
				const ip = d.global_ip;
				$this.prev('input').val(ip);
			})

		});
		$('a.getWallet').off('click').on('click',()=>{
			this.parentComponent.showAllKeysModal();
		})
	}
}