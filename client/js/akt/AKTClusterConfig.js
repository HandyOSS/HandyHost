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
			$('#ingressPortsMessage').hide();

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
		else{
			$('#ingressPortsMessage').hide();
			//clear out the kubernetes advanced opts
			$('#clusterInventory .configData').html('');
		}
	}
	autoConfigureK8sData(configData){
		let hasMaster = false;
		let hasEtcd = false;
		let hasIngress = false;

		configData.nodes.map(node=>{
			if(typeof node.kubernetes != "undefined"){
				if(node.kubernetes.role == 'master'){
					hasMaster = true;
				}
				if(node.kubernetes.role == 'etcd'){
					hasEtcd = true;
				}
				if(node.kubernetes.ingress){
					hasIngress = true;
				}
			}
		})
		const modified = configData.nodes.map((node,i)=>{
			let myRole;
			if(typeof node.kubernetes == "undefined"){
				myRole = 'none';
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
					ingress:(i == 0 && !hasIngress ? true : false),
					name:node.hostname.replace('.local','')
				}
			}
			else{
				myRole = node.kubernetes.role;
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
					ingress:node.kubernetes.ingress,
					name:node.hostname.replace('.local','')
				}
			}
			return node;
		});
		console.log('autconfigd cluster',modified);
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
			case 'ingressAnswer':
				title = 'Ingress Controller:';
				body = 'One single node must run the Ingress Controller which routes internet traffic to all the other nodes in the cluster. In addition: you must open port 80 and 30000-32767 to this particular machine in your internet router port forwarding.'
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
		$header.append('<th>Ingress Controller <div class="question" id="ingressAnswer">?</div></th>')
		$table.append($header);
		$('.question',$header).off('mouseenter').on('mouseenter',function(){
			_this.showQuestionPopup($(this).attr('id'));
		}).off('mouseleave').on('mouseleave',()=>{
			$('#answerPopup').hide();
		})
		let ingressName = '';
		let masterName = '';
		configData.nodes.map(node=>{
			if(!node.selected){
				return;
			}
			if(typeof node.kubernetes != "undefined"){
				
				let k8sName = node.kubernetes.name;
				let k8sRole = node.kubernetes.role;
				if(k8sRole == 'master'){
					masterName = k8sName;
				}
				if(node.kubernetes.ingress){
					ingressName = k8sName;
				}
			}
		})
		if(ingressName != ''){
			$('#ingressPortsMessage').show();
		}
		configData.nodes.map(node=>{
			if(!node.selected){
				return;
			}
			let k8nName = '';
			let k8nRole = '';
			let isCompute = false;
			let isIngress = false;
			let ingressSelected = '';
			const $k8nRoleSelect = $('<select class="role" />');
			$k8nRoleSelect.append('<option value="none">none</option>');
			$k8nRoleSelect.append('<option value="master">Master Node</option>');
			$k8nRoleSelect.append('<option value="etcd">etcd</option>');

			const $isComputeCheckbox = $('<input type="checkbox" class="isCompute" />')

			if(typeof node.kubernetes != "undefined"){
				const hostname = node.hostname.replace('.local','');
				k8nName = node.kubernetes.name;
				if(k8nName.indexOf(hostname) == -1){
					//must have changed, newly reconfigured server.
					//hostname & kubernetes name is joined by mac address and not user editable.
					k8nName = hostname;
				}
				k8nRole = node.kubernetes.role;
				isCompute = node.kubernetes.isCompute;
				$('option[value="'+k8nRole+'"]',$k8nRoleSelect).attr('selected','selected');
				if(isCompute){
					$isComputeCheckbox.attr('checked','checked');
				}
				/*if(masterName == ''){
					masterName = k8nName;
					k8nRole = 'master';
					$('option[value="'+k8nRole+'"]',$k8nRoleSelect).attr('selected','selected');
				}*/
				if(ingressName == '' && k8nRole == 'master'){
					ingressName = k8nName;
					isIngress = true;
					ingressSelected = ' checked="checked"';
				}
				if(!isIngress && ingressName == k8nName){
					isIngress = true;
					ingressName = k8nName;
					ingressSelected = ' checked="checked"';
				}
				if(isIngress){
					$('#ingressPortsMessage .ip').html(node.ip);
				}
			}
			const $tr = $('<tr />');
			$tr.append(`<td>${node.hostname}</td>`);
			$tr.append(`<td class="ip">${node.ip}</td>`);
			$tr.append(`<td><input class="nodename" type="hidden" placeholder="Short Name ie: akash0" value="${k8nName}" />${k8nName}</td>`)
			const $sel = $('<td />');
			$sel.append($k8nRoleSelect);
			$tr.append($sel);
			const $comp = $('<td />');
			$comp.append($isComputeCheckbox);
			$tr.append($comp)
			const $ingress = $(`<td><input type="radio" class="ingressRadio" name="ingress" value="${node.kubernetes.name}"${ingressSelected} data-ip="${node.ip}" /></td>`)
			$tr.append($ingress);
			$table.append($tr);
		})
		$('input[name="ingress"]').off('change').on('change',()=>{
			const ip = $('input[name="ingress"]:checked').attr('data-ip');
			$('#ingressPortsMessage .ip').html(ip);
			this.configData.nodes.map(node=>{
				let isIngress = false;
				if(node.ip == ip){
					isIngress = true;
				}
				if(typeof node.kubernetes != "undefined"){
					node.kubernetes.ingress = isIngress;
				}
			})
		})
		$('#initCluster').off('click').on('click',()=>{
			/*if(!confirm('If there is currently a kubernetes cluster, this operation will completely remove it. Still Continue?')){
				console.log('aborted');
				return;
			}*/
			let configOut = JSON.parse(JSON.stringify(configData));
			configOut.nodes = configOut.nodes.filter(n=>{
				return n.selected;
			})
			$('tr:not(.header)').each(function(){
				const name = $('input.nodename',$(this)).val();
				const role = $('select option:selected',$(this)).val();
				const isCompute = $('input[type="checkbox"]',$(this)).is(':checked');
				const isIngress = $('input[name="ingress"]',$(this)).is(':checked');
				const ip = $('td.ip',$(this)).html();
				configOut.nodes.map(node=>{
					if(node.ip == ip){
						node.kubernetes = {
							name,
							role,
							isCompute,
							ingress:isIngress
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
		$('#logs .logsMessage').html(`
			Kubernetes cluster build is running, it will take at least 5-20 minutes.
			<br />
			<small>Note: Your Current Deployments will not be removed, there may be a minute of cutover post-install.</small>
			`);
		setTimeout(()=>{
			$('body').scrollTop($('#initCluster').offset().top)
		},250);
		
		
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
		if($('#logs .logs pre').height() > $('.logs').height()){
			const diff = $('#logs .logs pre').height() - $('#logs .logs').height();
			$('#logs .logs').scrollTop(diff);
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
			if(output.nodes.length > 0){
				output.nodes = output.nodes.map(node=>{
					const hostname = node.hostname.replace('.local','');
					if(typeof node.kubernetes != "undefined"){
						const kname = node.kubernetes.name;
						if(kname.indexOf(hostname) == -1){
							//need to update the kubernetes name, this must have changed aka new host/config
							node.kubernetes.name = hostname;
						}
					}
					return node;
				})
			}
			const providerIP = $('#providerIP').val();
			const clusterIP = $('#providerIP').val();//$('#clusterIP').val();
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
				this.fetchData();

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
			console.log('clicked',id,$('#buildABoxModal .stepInfo#'+id).is(':visible'))
			if($('#buildABoxModal .stepInfo#'+id).is(':visible')){
				$('#buildABoxModal .stepInfo#'+id).hide();
			}
			else{
				$('#buildABoxModal .stepInfo#'+id).show();
			}
		})
		$('#buildABoxModal #chooseDevice').off('click').on('click',()=>{
			fetch('/api/akt/getUbuntuUSBDisks').then(d=>d.json()).then(r=>{
				if(typeof r.error != "undefined"){
					$('.chooseDeviceResult').html('<div class="usbError">'+r.error+'</div>');
				}
				else{
					const $select = $('<select class="styledSelect usbDevice" id="usbDevice"></select>')
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
		$('#buildABoxModal #finishHost').off('click').on('click',()=>{
			const path = $('#buildABoxModal #usbDevice option:selected').val();
			const hostname = $('#buildABoxModal #setHostname').val();
			if($('#buildABoxModal #finishHost').hasClass('nonActive')){
				return;
			}
			$('#buildABoxModal #finishHost').html('Creating ISO/Flashing USB...').addClass('nonActive');
			$('#buildABoxModal #autoConfig .error').hide();
			$('#buildABoxModal #autoConfig .confirmation').hide();
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
				$('#buildABoxModal #finishHost').html('Configure NVMe');
				console.log('result',data);
				if(typeof data.error == "undefined"){
					$('#buildABoxModal #autoConfig .confirmation').show();
				}
				else{
					$('#buildABoxModal #autoConfig .error').html('ERROR: '+data.error).show();
				}
			})
			.catch((res)=>{ 
				console.log("error",res);

			});
			}
		});
		//x86 build a box
		this.initBuildAX86Box();
	}
	initBuildAX86Box(){
		/*<div id="buildAX86Box" class="configPanel">
		<a id="buildX86Link" class="buildLink">Build/Setup New x86 Nodes <span class="expand">+</span></a>
	</div>*/
		$('#buildX86Link').off('click').on('click',()=>{
			this.parentComponent.showBuildAX86BoxModal();
		});
		$('#buildAX86BoxModal .step').off('click').on('click',function(){
			const id = $(this).attr('data-id');
			console.log('clicked',id,$('#buildAX86BoxModal .stepInfo#'+id).is(':visible'))
			if($('#buildAX86BoxModal .stepInfo#'+id).is(':visible')){
				$('#buildAX86BoxModal .stepInfo#'+id).hide();
			}
			else{
				$('#buildAX86BoxModal .stepInfo#'+id).show();
			}
		})
		$('#buildAX86BoxModal #chooseDevicex86').off('click').on('click',()=>{
			fetch('/api/akt/getThumbDrives').then(d=>d.json()).then(r=>{
				if(typeof r.error != "undefined"){
					$('#buildAX86BoxModal .chooseDeviceResult').html('<div class="usbError">'+r.error+'</div>');
				}
				else{
					//{platform:process.platform,usbs}
					const platform = r.platform;
					const usbs = r.usbs;
					if(usbs.length == 0){
						$('#buildAX86BoxModal .chooseDeviceResult').html('<div class="usbError">No USB Disks Detected</div>');
						return;
					}
					const $select = $('<select class="styledSelect usbDevice" id="usbDevicex86"></select>')
					usbs.map(usb=>{
						const diskSize = typeof usb.meta.size == 'number' ? numeral(usb.meta.size).format('0.0b') : usb.meta.size;
						const $option = $('<option value="'+usb.meta.device+'" data-diskid="'+usb.meta.path+'">'+usb.meta.model+' - '+diskSize+'</option>')
						$select.append($option);
					})
					$('#buildAX86BoxModal .chooseDeviceResult').html($select);
					let placeholder = 'Your Linux Password'
					let pwLabel = '<label for="sudoPW">*Note: Your Linux User Password is required to flash an attached USB device</label>'
					if(platform == 'darwin'){
						placeholder = 'Your MacOS Password'
						pwLabel = '<label for="sudoPW">*Note: Your MacOS User Password is required to flash an attached USB device</label>'
					}
					$('#buildAX86BoxModal .chooseDeviceResult').after(`
						<div class="chooseDeviceResult">
							<input type="password" id="sudoPW" class="styledInput" placeholder="${placeholder}" />
							${pwLabel}
						</div>
					`)
					if($('#buildAX86BoxModal .usbDevice option:selected').length > 0){
						$('#buildAX86BoxModal #finishHostx86').removeClass('nonActive');
					}
					else{
						$('#buildAX86BoxModal #finishHostx86').addClass('active');
					}
				}
			})
		});
		$('#buildAX86BoxModal #finishHostx86').off('click').on('click',()=>{
			const path = $('#buildAX86BoxModal #usbDevicex86 option:selected').val();
			const diskID = $('#buildAX86BoxModal #usbDevicex86 option:selected').attr('data-diskid')
			if($('#buildAX86BoxModal .finishHost').hasClass('nonActive')){
				return;
			}
			$('#buildAX86BoxModal .finishHost').html('Creating ISO/Flashing USB...').addClass('nonActive');
			$('#buildAX86BoxModal .autoConfig .error').hide();
			$('#buildAX86BoxModal .autoConfig .confirmation').hide();
			if(typeof path != "undefined"){
					//submit vals
					fetch("/api/akt/flashThumbDrive",
				{
				    headers: {
				      'Accept': 'application/json',
				      'Content-Type': 'application/json'
				    },
				    method: "POST",
				    body: JSON.stringify({path,pw:$('#sudoPW').val(),id:diskID})
				})
				.then((res)=>{ console.log('success'); return res.json(); }).then(data=>{
					$('#buildAX86BoxModal .finishHost').html('Create Ubuntu Auto-Installer');
					$('#finishHostx86').removeClass('nonActive');
					console.log('result',data);
					if(typeof data.error == "undefined"){
						$('#buildAX86BoxModal .autoConfig .confirmation').show();
						$('#buildAX86BoxModal .autoConfig .error').hide();

					}
					else{
						$('#buildAX86BoxModal .autoConfig .confirmation').hide();
						$('#buildAX86BoxModal .autoConfig .error').html('ERROR: '+data.error).show();
					}
				})
				.catch((res)=>{ 
					console.log("error",res);

				});
			}
			console.log('device path',path);
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
				$('.myip').html(': '+ip);
			})

		});
		$('a.getWallet').off('click').on('click',()=>{
			this.parentComponent.showAllKeysModal();
		})
	}
}