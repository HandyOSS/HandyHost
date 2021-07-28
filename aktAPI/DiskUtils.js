import {spawn} from 'child_process';

export class DiskUtils{
	constructor(){

	}
	getDisks(node){
		return new Promise((resolve,reject)=>{
			//fetch disks
			console.log('spawn fdisk',node);
			this.spawnFdisk(node).then(disks=>{
				resolve(disks);
			}).catch(e=>{
				reject(e);
			})
		});
	}
	spawnFdisk(node){
		return new Promise((resolve,reject)=>{
			const opts = [
				'-i',
				process.env.HOME+'/.ssh/handyhost',
				'pi@'+node.ip,
				'bash --login echo "" | sudo fdisk -l'
			];
			//console.log('opts',opts);
			let out = '';
			const p = spawn('ssh',opts);
			p.stdout.on('data',(d)=>{
				out += d.toString();
			})
			p.stderr.on('data',(d)=>{
				console.log('fdisk err',d.toString())
			})
			p.on('close',()=>{
				//now parse
				//console.log('ooutput',out);
				resolve(this.parseFdiskResult(out))
			})
		})
		
	}
	whitespaceSplit(str){
		return str.split(' ').filter(p=>{return p.length > 0;})
	}
	getColumnPositions(str){
		let keys = this.whitespaceSplit(str);
		let out = {};
		keys.map((key,i)=>{
			let last = false;
			let end = str.indexOf(key) + key.length;
			let start = typeof keys[i-1] != "undefined" ? str.indexOf(keys[i-1]) + keys[i-1].length+1 : 0;
			if(i == 1){
				//first col is left aligned....
				start = str.indexOf(keys[i])-1;
			}
			if(i == 0){
				end = str.indexOf(keys[i+1]);
			}
			if(i == keys.length-1){
				end = str.length+1;
				last = true;
			}
			out[key] = {
				start,
				end,
				last
			};
		});
		return out;
	}
	getColumnValues(str,keys){
		let out = {};
		Object.keys(keys).map(key=>{
			let start = keys[key].start;
			let end = keys[key].end;
			if(keys[key].last){
				end = str.length;
			}
			out[key.toLowerCase()] = str.slice(start,end).trim();
		})
		return out;
	}
	parseFdiskResult(result){

		let devices = result.split('\n\n');
		console.log(devices.length);
		devices = devices.map(d=>{
			return d.split('\n').filter(l=>{return l.length > 0;})
		})
		devices = devices.filter(d=>{
			if(d[0].indexOf('/ram') >= 0 && d[0].indexOf('Disk ') >= 0){
				return false;
			}
			return true;
		})
		let results = devices.map((device,i)=>{
			if(device[0].indexOf(':') >= 0){
				//is disk
				//Disk /dev/sdh: 476.96 GiB, 512110190592 bytes, 1000215216 sectors\n
				let diskInfoParts = device[0].split(':');
				let diskPath = diskInfoParts[0].split(' ')[1].trim();
				let diskSize = diskInfoParts[1].split(',')[0].trim();
				let diskModel = '';
				//Disk model: RTL9210 NVME    \n
				if(device[1].toLowerCase().indexOf('disk model') >= 0){
					diskModel = device[1].split(':')[1].trim();
				}
				return {
					type:'disk',
					data:{
						device: diskPath,
						size: diskSize,
						model:diskModel
					}
				}
			}
			else{
				//is partition
				let keys = this.getColumnPositions(device[0]);
				//let keys = this.whitespaceSplit(device[0]).filter(k=>{return k.toLowerCase() != 'boot';});
				let vals = device.slice(1).map(str=>{
					return this.getColumnValues(str,keys);
					
				})
				return {
					type:'partitions',
					data:vals
				}
			}
		});
		return results;
	}
	addDisk(node,disk){
		return new Promise((res,rej)=>{
			//first get possible partitions we need to remove
			new Promise((resolve,reject)=>{
				this.getDisks(node).then(disks=>{
					const partitions = disks.filter(d=>{
						return d.type == 'partitions';
					});
					const toRemove = [];
					partitions.map(p=>{
						p.data.map(partition=>{
							if(partition.device.indexOf(disk) == 0){
								toRemove.push(partition.device.replace(disk,'').trim());
							}
						});
					})
					if(toRemove.length > 0){
						this.removePartitions(node,toRemove,disk).then(()=>{
							resolve();
						})
					}
					else{
						resolve();
					}

				})
			}).then(()=>{
				console.log('add partitions');
				//now we can add disk
				this.addPartition(node,disk).then(()=>{
					//done adding, 
					//final check if the partition is present, then add to fstab
					this.getDisks(node).then(disks=>{
						const partitions = disks.filter(d=>{
							return d.type == 'partitions';
						});
						const addPartition = [];
						partitions.map(p=>{
							p.data.map(partition=>{
								if(partition.device.indexOf(disk) == 0){
									addPartition.push(partition.device.trim());
								}
							});
						});
						if(addPartition.length == 1){
							console.log("TIME TO MOUNT");
							this.mountPartition(node,addPartition[0]).then(()=>{
								res({mounted:true})
							})
						}
					});
				})
			})
		})
		
		
	}
	cleanupFstab(node,partition){
		return new Promise((resolve,reject)=>{
			const opts0 = [
				'-i',
				process.env.HOME+'/.ssh/handyhost',
				'pi@'+node.ip,
				'cat /etc/fstab'
			];

			console.log('GET FSTAB OPTS',opts0);
			let out = '';
			const p = spawn('ssh',opts0);
			p.stdout.on('data',(d)=>{
				out += d.toString();
			})
			p.stderr.on('data',(d)=>{
				console.log('mount err',d.toString())
			})
			p.on('close',()=>{
				
				console.log('trimmed fstab',out);
				let newFstab = [];
				out.split('\n').map(line=>{
					if(line.indexOf(partition) != 0){
						newFstab.push(line);
					}
				})
				console.log('new fstab');
				console.log(newFstab.join('\n').trim());
				const opts1 = [
					'-i',
					process.env.HOME+'/.ssh/handyhost',
					'pi@'+node.ip,
					'bash --login -c \'sudo su -c "echo \\"'+(newFstab.join('\n').trim())+'\\" > /etc/fstab"\''
				];
				const p2 = spawn('ssh',opts1);
				p2.on('close',()=>{
					resolve();
				})
				//now format the partition
				//resolve();
			})
		})
	}
	mountPartition(node,partition){
		return new Promise((resolve,reject)=>{
			//first check if fstab contains our partition name, if so remove it..
			this.cleanupFstab(node,partition).then(()=>{
				const opts = [
					'-i',
					process.env.HOME+'/.ssh/handyhost',
					'pi@'+node.ip,
					'bash --login -c \'sudo mkdir -p /mnt/disks/nvme1 && sudo chown -R pi:pi /mnt/disks && sudo su -c "echo \\"\n'+partition+' /mnt/disks/nvme1 ext4 defaults,noatime 0 0\\" >> /etc/fstab" && sudo mount -av\''
				];

				console.log('MOUNT PARTITION OPTS',opts);
				let out = '';
				const p = spawn('ssh',opts);
				p.stdout.on('data',(d)=>{
					out += d.toString();
				})
				p.stderr.on('data',(d)=>{
					console.log('mount err',d.toString())
				})
				p.on('close',()=>{
					console.log('mounted?',out);
					
					//now format the partition
					resolve();
				})
			})
			
		})
		
	}
	addPartition(node,disk){
		return new Promise((resolve,reject)=>{
			const opts = [
				'-i',
				process.env.HOME+'/.ssh/handyhost',
				'pi@'+node.ip,
				'bash --login -c \'(echo "n"; echo "p"; echo "1"; echo ""; echo ""; echo "Y"; echo "w";) | sudo fdisk '+disk+'\''
			];
			console.log('ADD PARTITION OPTS',opts);
			//console.log('opts',opts);
			let out = '';
			const p = spawn('ssh',opts);
			p.stdout.on('data',(d)=>{
				out += d.toString();
			})
			p.stderr.on('data',(d)=>{
				console.log('fdisk add err',d.toString())
			})
			p.on('close',()=>{
				console.log('added?',out);
				
				//now format the partition
				const formatOpts = [
					'-i',
					process.env.HOME+'/.ssh/handyhost',
					'pi@'+node.ip,
					'bash --login -c \'(echo "y";) | sudo mkfs -t ext4 '+disk+'1\''
				]
				const fp = spawn('ssh',formatOpts);
				let fpOut = '';
				fp.stdout.on('data',d=>{
					fpOut += d.toString();
				})
				fp.stderr.on('data',d=>{
					console.log("format partition error?",d.toString())
				})
				fp.on('close',()=>{
					console.log('format partition done!',fpOut);
					resolve();
				})
			})
		})
	}
	removePartitions(node,partitions,disk){
		return new Promise((resolve,reject)=>{
			let removeCount = 0;
			let removeTotal = partitions.length;

			partitions.map(partition=>{
				const opts = [
					'-i',
					process.env.HOME+'/.ssh/handyhost',
					'pi@'+node.ip,
					'bash --login -c \'(echo "d"; echo "'+partition+'"; echo "w";) | sudo fdisk '+disk+' && sudo umount '+disk+partition+'\''
				];
				console.log('DELETE PARTITION OPTS',opts);
				//console.log('opts',opts);
				let out = '';
				const p = spawn('ssh',opts);
				p.stdout.on('data',(d)=>{
					out += d.toString();
				})
				p.stderr.on('data',(d)=>{
					console.log('fdisk rm err',d.toString())
				})
				p.on('close',()=>{
					console.log('removed?',out);
					//now parse
					//console.log('ooutput',out);
					removeCount++;
					if(removeCount == removeTotal){
						resolve();
					}
				})
			})
		})

	}
	getUbuntuUSBNVMe(){
		//get a list of attached nvme disks with meta and name
		return new Promise((resolve,reject)=>{
			this.getUSBFromDF().then(detectedUSBs => {
				if(detectedUSBs.length > 0){
					//found usbs, get meta from fdisk
					this.getVolumeMeta(detectedUSBs).then(usbsWithMeta=>{
						resolve(usbsWithMeta);
					}).catch(error=>{
						console.log('error',error);
					})
				}
				else{
					resolve({
						error: "no usb found"
					})
				}
			})
		})
	}
	getVolumeMeta(usbs){
		console.log('get vol meta');
		return new Promise((resolve,reject)=>{
			let fdiskOut = '';
			const fdisk = spawn('sudo',['fdisk','-l'])
			fdisk.stdout.on('data',d=>{
				//console.log('fdisk out',d.toString())
				fdiskOut += d.toString();
			})
			fdisk.stderr.on('data',d=>{
				console.log('stderr',d.toString())
			})
			fdisk.on('close',()=>{
				//console.log('fdisk out',fdiskOut);
				let parsed = this.parseFdiskResult(fdiskOut);
				//console.log('fdisk res',parsed);
				let devicePaths = usbs.map(usb=>{
					return usb.disk;
				})
				parsed.map(disk=>{
					/*
					type:'disk',
					data:{
						device: diskPath,
						size: diskSize,
						model:diskModel
					}
					*/
					if(disk.type == 'disk'){
						if(devicePaths.indexOf(disk.data.device) >= 0){
							usbs[devicePaths.indexOf(disk.data.device)].meta = disk.data;
						}
					}
				})
				resolve(usbs);
			})
			
		});
		
	}
	getUSBFromDF(){
		return new Promise((resolve,reject)=>{
			let dfOut = '';
			const df = spawn('df',['--output=source,target']);
			df.stdout.on('data',d=>{
				dfOut += d.toString();

			});
			df.on('close',()=>{
				let lines = dfOut.split('\n').filter(l=>{
					return l.length > 0;
				});
				let output = [];
				//console.log('df lines',lines);
				lines.map(line=>{
					let parts = line.split(' ').filter(l=>{
						return l.length > 0;
					});
					//console.log('parts',parts);
					if(parts.length == 2){
						let parentPath = parts[0].split('/');
						parentPath = parentPath.map((p,i)=>{
							//so if its /dev/sdh1 we want /dev/sdh
							let out = p;
							if(i == parentPath.length-1){
								out = p.replace(/[0-9]/g, '');
							}
							return out;
						}).join('/');
						if(parts[1].indexOf('system-boot') >= 0){
							output.push({
								path:parts[0],
								mountPoint:parts[1],
								disk:parentPath
							})
						}
					}
				});
				//console.log('out',output);
				resolve(output);
			})

		})
	}
}