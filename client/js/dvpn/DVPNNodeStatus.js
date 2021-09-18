export class DVPNNodeStatus{
	constructor(parentComponent){
		this.parentComponent = parentComponent;
		this.nodeIsActive = false;
		this.ansi_up = new AnsiUp();
		fetch('./uiFragments/dvpn/nodeStatus.html').then(res=>res.text()).then(fragment=>{
			$('body').append(fragment);
			this.initStatus();
		})
		
	}
	show(){
		this.showing = true;
		$('#nodeStatusInfo').show();
	}
	hide(){
		this.showing = false;
		$('#nodeStatusInfo').hide();
	}
	showModal(){
		$('#launchNodeModal').show();
		$('.launchModal').addClass('showing');
		$('#launchPW').off('keyup').on('keyup',(e)=>{
			if(e.keyCode == 13){
				//hit enter
				$('#launchPW').blur();
				$('#launchNode').trigger('click');
			}
		})
		$('#launchNode').off('click').on('click',()=>{
			fetch("/api/dvpn/launch",
			{
			    headers: {
			      'Accept': 'application/json',
			      'Content-Type': 'application/json'
			    },
			    method: "POST",
			    body: JSON.stringify({pw:$('#launchPW').val(),autostart:$('#autostart').is(':checked')})
			})
			.then((res)=>{ console.log('success'); return res.json(); }).then(data=>{
				console.log('res data',data);
				//this.hideModal(); //maybe party panda?
				if(typeof data.error != "undefined"){
					this.showFailModal(data);
				}
				else{
					this.updateLogs('Starting DVPN Node...');
					this.hideModal();
					$('#showLaunchModal').hide();
					$('#haltDVPN').show();
					this.setStatus(true);
				}
			})
			.catch((res)=>{ console.log('error submitting',res) })
		})
		$('#cancelLaunch').off('click').on('click',()=>{
			this.hideModal();
		})
	}
	hideModal(){
		$('#launchPW').val('');
		$('#launchNodeModal').hide();
		$('.launchModal').addClass('showing');
	}
	showFailModal(data){
		$('.launchModal').removeClass('showing');
		$('.failModal').addClass('showing');
		let message = data.error;
		if(message.indexOf('account does not exist with address') >= 0){
			message += '<br />This means you need to send some funds to the address.'
		}
		$('.failModal .message').html(message);
		$('.failModal #fail.button').off('click').on('click',()=>{
			$('.failModal').removeClass('showing');
			this.hideModal();
			$('.launchModal').addClass('showing');
		})
	}
	initStatus(){
		if(this.nodeIsActive){
			$('#showLaunchModal').hide();
			$('#haltDVPN').show();
		}
		else{
			$('#showLaunchModal').show();
			$('#haltDVPN').hide();
		}
		$('#showLaunchModal').off('click').on('click',()=>{
			this.showModal();
		})
		$('#haltDVPN').off('click').on('click',()=>{
			fetch('/api/dvpn/stop').then(res=>res.json()).then(json=>{
				console.log('halted',json);
				if(json.stop){
					this.updateLogs('Halted DVPN Node');
					$('#showLaunchModal').show();
					$('#haltDVPN').hide();
					this.setStatus(false);
					this.parentComponent.fetchDashboardData();
				}
			})
		})
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
	setStatus(isActive){
		this.nodeIsActive = isActive;
		if(this.nodeIsActive){
			$('#showLaunchModal').hide();
			$('#haltDVPN').show();
			$('.statusBubble .label').html('Active');
			$('.statusBubble .bubble').addClass('active').removeClass('inactive');
			$('.isActiveBadge').show();
		}
		else{
			$('#showLaunchModal').show();
			$('#haltDVPN').hide();
			$('.statusBubble .label').html('Not Active');
			$('.statusBubble .bubble').removeClass('active').addClass('inactive');
			$('.isActiveBadge').hide();
		}
	}
	addBulkLogs(logBulk){
		if(logBulk == ''){
			return;
		}/*
		if(!this.nodeIsActive){
			return; //dont show old logs
		}*/
		let lines = logBulk.split('\n');
		lines.map(line=>{
			this.updateLogs(line+'\n',false);
		})
	}
	/*dvpn node updates avail from github*/
	prepareUpdatesPanel(updatesData){
		const currentTag = updatesData.current;
		const nextTag = updatesData.all[updatesData.all.length-1];
		const $ul = $('<ul />')
		$ul.append('<div class="updateTitle">Update DVPN-NODE</div>')
		$ul.append('<li>Current: '+currentTag+'</li>')
		$ul.append('<li>Latest: '+nextTag+'</li>')
		$('#updateDVPNModal .updateInfo').html($ul);
	}
	prepareHandyHostUpdatesPanel(updatesData){
		const currentTag = updatesData.local;
		const nextTag = updatesData.latest;
		const $ul = $('<ul />')
		$ul.append('<div class="updateTitle">Update HandyHost</div>')
		$ul.append('<li>Current: '+currentTag+'</li>')
		$ul.append('<li>Latest: '+nextTag+'</li>')
		$('#updateHandyHostModal .updateInfo').html($ul);
	}
	showHandyHostUpdateModal(){
		//show the modal
		$('#updateHandyHostModal').show();
		$('#updateHandyHostModal .modalContent').addClass('showing');
		$('#updateHandyHostModal .closeModal').off('click').on('click',()=>{
			$('#updateHandyHostModal').hide();
		});
		$('#updateHandyHostModal #updateHandyHost.save').off('click').on('click',()=>{

			//hide this, start the update, on finish hide the update button in the dashboard
			//this.updateLogs('\nStarting DVPN Node Update...\n')
			//$('#updateHandyHostModal').hide();
			$('#updateHandyHostModal #updateHandyHost').removeClass('save').addClass('cancel');
			$('#updateHandyHostModal #updateHandyHost .foreground, #updateHandyHostModal #updateHandyHost .background').html('Updating...');
			fetch('/api/updateHandyHost').then(d=>d.json()).then(json=>{
				console.log('done with update???',json);
				$('#dvpnMain .options li#handyhostUpdatesWarning').hide();
				$('#updateHandyHostModal .updateInfo').html("Update Complete! Reloading in <span class=\"secVal\">20</span>s...")
				let i = 20;
				const reloadInterval = setInterval(()=>{
					i = i-1 <= 0 ? 0 : i-1;
					$('#updateHandyHostModal .secVal').html(i);
				},1000);
				setTimeout(()=>{
					clearInterval(reloadInterval);
					window.location.reload();
				},20000);
			})
		});
		$('#updateHandyHostModal #cancelHandyHostUpdate').off('click').on('click',()=>{
			$('#updateHandyHostModal').hide();
		})
		
	}
	showDVPNUpdateModal(){
		//show the modal
		$('#updateDVPNModal').show();
		$('#updateDVPNModal .modalContent').addClass('showing');
		$('#updateDVPNModal .closeModal').off('click').on('click',()=>{
			$('#updateDVPNModal').hide();
		});
		$('#updateDVPNModal #updateNode').off('click').on('click',()=>{
			//hide this, start the update, on finish hide the update button in the dashboard
			this.updateLogs('\nStarting DVPN Node Update...\n')
			$('#updateDVPNModal').hide();
			$('#showLaunchModal').removeClass('save').addClass('cancel');
			$('#showLaunchModal .foreground, #showLaunchModal .background').html('Updating...');
			fetch('/api/dvpn/updateDVPN').then(d=>d.json()).then(json=>{
				console.log('done with update???',json);
				$('#dvpnMain .options li#dvpnUpdatesWarning').hide();
				$('#showLaunchModal').addClass('save').removeClass('cancel');
				$('#showLaunchModal .foreground, #showLaunchModal .background').html('Launch DVPN Node');
			})
		});
		$('#updateDVPNModal #cancelUpdate').off('click').on('click',()=>{
			$('#updateDVPNModal').hide();
		})
		
	}
	
}