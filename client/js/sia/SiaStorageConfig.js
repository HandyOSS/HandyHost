
export class SiaStorageConfig{
	constructor(){
		this.folderSliderValues = {};
		this.tempFolders = {};//temp state while we edit in case we cancel
		fetch('./uiFragments/sia/storageInfo.html').then(res=>res.text()).then(fragment=>{
			$('body').append(fragment);
			this.load();
		})
		
	}
	show(){
		this.load();
		$('#siaStorageInfo').show();
	}
	hide(){
		$('#siaStorageInfo').hide();
	}
	load(){
		this.getStorageConfig().then(data=>{
			this.configData = data;
			this.initUI(data)
		})
	}
	initUI(){
		let configData = this.configData;
		const $el = $('#siaStorageInfo');
		const $ul = $('<ul />')
		//$ul.append('<div class="hostTitle"><img src="./img/SiacoinSCLogo.svg" />Sia Storage Settings</div>')
		$ul.append('<div class="hostTitle">Storage Settings</div>')
		let isAnyFolderEditing = false;
		if(configData.folders != null){
			console.log('folders',configData.folders);
			configData.folders.sort((a,b)=>{
				if(a.path < b.path) { return -1; }
			    if(a.path > b.path) { return 1; }
			    return 0;
			}).map((folder,folderI)=>{
				const path = folder.path;
				let capacity = folder.capacity;
				let remaining = folder.capacityremaining;
				const isNew = typeof folder.isNew == "undefined" ? false : true;
				const isEditing = typeof folder.isEditing == "undefined" ? false : folder.isEditing; //are we actively editing this folder
				const isDeletingClass = typeof folder.isDeleting == 'undefined' ? '' : (folder.isDeleting ? 'isDeleting' : '');
				const isEditingClass = isEditing ? ' isEditing' : '';
				let capacityLabel = 'Folder Capacity: ';
				if(isNew || isEditing){
					capacityLabel = 'Disk Capacity:';
				}
				if(isEditing || folder.isDeleting){
					isAnyFolderEditing = true;
				}
				if(!isNew && !isEditing){
					//existing setting
					capacity = this.factorOf64SectorsToHumanReadableStorage(capacity);
					remaining = this.factorOf64SectorsToHumanReadableStorage(remaining);
				}
				const $li = $('<li class="'+isDeletingClass+isEditingClass+'">📁'+path+' <div class="capacity">'+capacityLabel+numeral(capacity).format('0.00b')+', Available: '+numeral(remaining).format('0.00b')+' ('+(Math.floor(remaining/capacity*10000)/100)+'%)</div></li>');
				$li.append('<div class="editButton"></div><div class="deleteButton"></div>')
				const $folder = $($li);
				let sliderInitVal = 0;
				let storageValLabel = '0.00B';
				if(typeof this.folderSliderValues[path] != "undefined"){
					sliderInitVal = this.folderSliderValues[path].sliderVal;
					storageValLabel = this.folderSliderValues[path].storageValLabel;
				}
				else{
					storageValLabel = numeral(folder.capacity - folder.capacityremaining).format('0.00b');
				}
				//TODO: replace slider with bar chart until editing previous settings
				if(isNew || isEditing){
					$folder.append('<div class="range"><input type="range" min="0" max="100" value="'+sliderInitVal+'" class="slider"><span class="value">'+storageValLabel+'</span></div>')
				}
				else{
					const barPercentage = Math.floor(((capacity - remaining) / capacity)*100);
					$folder.append('<div class="range"><span class="bar"></span><span class="value">'+storageValLabel+'</span></div>')
					const gradient = 'linear-gradient(to right, #23db75 0%,#24ed82 '+barPercentage+'%,#e5e5e5 '+(barPercentage+1)+'%,#d6d6d6 100%)';
					$('.bar',$folder).css('background',gradient)
				}
				$('.range input',$folder).off('input').on('input',()=>{
					const val = $('.range input',$folder).val();
					const numVal = (val/100)*(remaining)
					const label = numeral(numVal).format('0.00b');
					$('.range .value',$folder).html(label);
					this.folderSliderValues[path] = {
						sliderVal:val,
						storageVal:numVal,
						storageValLabel:label
					};
					configData.folders[folderI].capacity_updated = numVal;
					
				}).off('change').on('change',()=>{
					configData.folders[folderI].isEdited = true;
				})

				$('.editButton',$li).off('click').on('click',()=>{
					configData.folders[folderI].isEditing = true;
					fetch('/api/sia/getDirCapacity/'+encodeURIComponent(configData.folders[folderI].path)).then(result=>result.json()).then(data=>{
						const diskCapsRemaining = parseInt(data.avail)/1048576*1000000 * 1000;
						if(typeof this.folderSliderValues[configData.folders[folderI].path] == "undefined"){
							const currentCapsHR = this.factorOf64SectorsToHumanReadableStorage(configData.folders[folderI].capacity);
							let sliderVal = (currentCapsHR/diskCapsRemaining) * 100;
							this.folderSliderValues[configData.folders[folderI].path] = {
								sliderVal:sliderVal,
								storageVal:currentCapsHR,
								storageValLabel:numeral(currentCapsHR).format('0.00b')
							};
						}
						let folderMeta = {
					      "path": configData.folders[folderI].path,
					      "capacity": parseInt(data.KBlocks)/1048576*1000000 * 1000,
					      "capacityremaining": diskCapsRemaining,
					      "failedreads": 0,
					      "failedwrites": 0,
					      "successfulreads": 0,
					      "successfulwrites": 0,
					      "isNew":false,
					      "isEditing":true
					    };

					    this.tempFolders[configData.folders[folderI].path] = JSON.parse(JSON.stringify(configData.folders[folderI]));
					    this.configData.folders[folderI] = folderMeta;
					    this.initUI();
					});
				})
				$('.deleteButton',$li).off('click').on('click',()=>{
					configData.folders[folderI].isEditing = false;
					if(configData.folders[folderI].isDeleting){
						configData.folders[folderI].isDeleting = false;
					}
					else{
						configData.folders[folderI].isDeleting = true;
					}
					this.initUI();

				})
				$ul.append($folder);
			})
		}
		//$ul.append($newFolder)
		$el.html($ul);
		const $submit = $('<div class="buttons" />');
		const $addnew = $('<div class="button save" id="addnew"><div class="foreground">add new folder</div><div class="background">add new folder</div></div>');
		const cancelShowing = isAnyFolderEditing;
		
		let $cancel = $('<div class="button cancel" style="display:none;"><div class="foreground">cancel</div><div class="background">cancel</div></div>');
		if(cancelShowing){
			$cancel.show();
		}
		const $save = $('<div class="button save"><div class="foreground">save</div><div class="background">save</div></div>')
		$submit.append($cancel);
		$submit.append($save);
		$submit.append($addnew);
		$addnew.off('click').on('click',()=>{
			fetch('/api/sia/getDirList').then(res=>res.json()).then(data=>{
				this.showPathModal(data);
			})
		})
		$save.off('click').on('click',()=>{
			console.log('folders',this.folderSliderValues,this.configData);
			const output = this.configData.folders.map(d=>{
				const isNew = typeof d.isNew == "undefined" ? false : d.isNew;
				const isEdited = typeof d.isEdited == "undefined" ? false : d.isEdited;
				const isDeleting = typeof d.isDeleting == "undefined" ? false : d.isDeleting;
				const capVal = typeof d.capacity_updated == "undefined" ? d.capacity : d.capacity_updated;
				const caps = this.factorOf64SectorsFromHumanReadableStorage(capVal);
				return {
					capacity:caps,
					isNew,
					isEdited:isEdited,
					isDeleting:isDeleting,
					path:d.path
				}
			});
			console.log('to post',output);
			this.postData('/api/sia/updateFolders',output).then(res=>res.json()).then(data=>{
				this.configData = data;
				this.folderSliderValues = {};
				//reinit the state
				console.log('success posting folders',data);
				this.initUI();
			}).catch(error=>{
				console.log('error posting folders',error);
			})

		});
		$cancel.off('click').on('click',()=>{
			this.load();
		});
		$el.append($ul);
		$el.append($submit);
		
	}
	factorOf64SectorsFromHumanReadableStorage(capacity){
		//take human readable bytes and convert into 1K blocks % 64sectors
		//SC wants sectors to a factor of 64
		let caps = capacity * (1024*1024)/1000000000; //num bytes in all sectors
		caps = caps * 1024 / 4096; // KB block / num sectors
		caps = Math.floor(caps/Math.pow(64,3))*Math.pow(64,3) * 4096; //sectors to nearest %64sectors * bytespersector
		return caps;
	}
	factorOf64SectorsToHumanReadableStorage(capacity){
		//take 1K blocks (1024 bytes) from df and convert into human readable bytes
		let caps = capacity / (1024*1024)*1000000000; //to bytes not in 1K blocks
		caps = caps / 1024 * 4096; //4096 bytes in a 1K block (1024)
		caps = caps / 4096; //bytes!
		return caps;
	}
	postData(path,postData){
		const postOptions = {
		    headers: {
		      'Accept': 'application/json',
		      'Content-Type': 'application/json'
		    },
		    method: "POST",
		    body: JSON.stringify(postData)
		}
		return fetch(path,postOptions);
	}
	showPathModal(dirList){
		const $ul = $('<ul />')
		let base = dirList.base;
		const $select = $('<select id="pathShortcut"></select>')
		let pathBuilt = [];
		
		if(base == '/'){
			$select.append('<option value="/" selected>/</option>')
		}
		else{
			const baseSplit = base.split('/');
			baseSplit.map((part,i)=>{
				pathBuilt.push(part);
				let pathDisp;
				if(pathBuilt.length == 1){
					pathDisp = '/';
				}
				else{
					pathDisp = pathBuilt.join('/');
				}
				let $option = $('<option value="'+pathDisp+'">'+pathDisp+'</option>');
				$select.append($option);
				if(i == baseSplit.length-1){
					$option.attr('selected','selected');
				}
			})
		}
		
		$select.off('change').on('change',()=>{
			let val = $('option:selected',$select).val();
			fetch('/api/sia/getDirList/'+encodeURIComponent(val)).then(res=>res.json()).then(data=>{
				this.showPathModal(data);
			})
		})
		dirList.paths.map(val=>{
			let pbase = base == '/' ? base : base+'/';
			let $li = $('<li data-path="'+(pbase+val)+'">📁'+val+'</li>')
			$ul.append($li);
			$li.off('dblclick').on('dblclick',()=>{
				let p = encodeURIComponent(pbase+val);

				fetch('/api/sia/getDirList/'+p).then(res=>res.json()).then(data=>{
					this.showPathModal(data);
				})
			});
			$li.off('click').on('click',()=>{
				$('li',$ul).removeClass('selected');
				$li.addClass('selected');
			})
		})
		$('.pathSelectUtil').html($select)
		$('.pathSelectUtil').append($ul);
		const $submit = $('<div class="buttons" />');
		const $cancel = $('<div class="button cancel"><div class="foreground">cancel</div><div class="background">cancel</div></div>');
		const $save = $('<div class="button save"><div class="foreground">select</div><div class="background">select</div></div>')
		$submit.append($save);
		$submit.append($cancel);
		$cancel.off('click').on('click',()=>{
			$('.pathSelectModal').hide();
		})
		$save.off('click').on('click',()=>{
			let val = $('li.selected',$ul).attr('data-path');
			if(typeof val == "undefined"){
				//didnt single click..
				val = base;
			}
			console.log('saved ',val);
			fetch('/api/sia/getDirCapacity/'+encodeURIComponent(val)).then(result=>result.json()).then(data=>{
				console.log('got caps',data);
				let folderMeta = {
			      "path": val,
			      "capacity": parseInt(data.KBlocks)/1048576*1000000 * 1000,
			      "capacityremaining": parseInt(data.avail)/1048576*1000000 * 1000,
			      "failedreads": 0,
			      "failedwrites": 0,
			      "successfulreads": 0,
			      "successfulwrites": 0,
			      "isNew":true
			    };
			    if(this.configData.folders == null){
			    	this.configData.folders = [];
			    }
			    this.configData.folders.push(folderMeta);
			    this.initUI();
			})
			
			$('.pathSelectModal').hide();
		})
		$('.pathSelectUtil').append($submit);
		$('.pathSelectModal').show();
	}
	getStorageConfig(){
		//todo fetch
		return new Promise((resolve,reject)=>{
			fetch('/api/sia/getStorage').then(res=>res.json()).then(data=>{
				resolve(data);
			}).catch(error=>{
				reject(error);
			})
			
		})
		
	}

}