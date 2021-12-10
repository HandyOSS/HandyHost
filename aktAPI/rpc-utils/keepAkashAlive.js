const spawn = require('child_process').spawn;
const fs = require('fs');
const BlockoRama = require(__dirname+'/BlockoRama.js');
const redisBlockHarvest = new BlockoRama();
const aggsEndpoint = require(__dirname+'/redisAggregatesEndpoint.js');
aggsEndpoint.start();

let alreadyPast455200 = false;
let effedBlock = 455200;

//this assumes you have installed akash binaries in /usr/akash/bin/ (latest), and /usr/akash/v0.10.2/bin
//and youre running this file in /usr/akash
//see Dockerfile for more info on node modules/etc

let akashVersion = '/usr/akash/v0.10.2/bin/akash';
if(fs.existsSync('/usr/akash/lastknownheight')){
	const lastHeight = parseInt(fs.readFileSync('/usr/akash/lastknownheight','utf8'));
	if(lastHeight < effedBlock){
		akashVersion = '/usr/akash/v0.10.2/bin/akash';
	}
	else{
		akashVersion = '/usr/akash/bin/akash'
	}
}
console.log('akash RPC version running',akashVersion);
let timeout;
let is455200 = false;
startAkash();
setTimeout(()=>{
	//give akash some time to bootstrap
	checkRedisHeight();

},60000);
function checkRedisHeight(){
	redisBlockHarvest.checkHeight().then(output=>{
		console.log('redis harvest data back',output);
		setTimeout(()=>{
			//wait 1 minute and then check again forever.
			checkRedisHeight();
		},60000)
	}).catch(err=>{
		console.log('error checking redis harvest height',err);
	})
}
function startAkash(){
	if(typeof timeout != "undefined"){
		clearTimeout(timeout);
		timeout = undefined;
	}
	//const akash = spawn('./start.sh',{detached:true,shell:true});

	const akash = spawn(akashVersion,['start','--log_format','json'],{detached:true,shell:true});

	akash.stderr.on('data',d=>{
		let line = d.toString();
		let json = {};
		try{
			json = JSON.parse(line);
		}
		catch(e){

		}
		if(typeof json.height == "undefined"){
			return;
		}
		if(json.height == effedBlock){
			//for whatever reason i have to use akash v0.10.2 to sync up to block 455200, then move to latest
			//and i cant use latest else it falls over at block 969, wtf mate
			is455200 = true;
			console.log('we hit 455200');
			fs.writeFileSync('/usr/akash/wehit455200','455200');
		}
		
		if(json.height % 100 == 0){
			console.log('sync height:',json.height);
			fs.writeFileSync('/usr/akash/lastknownheight',json.height.toString(),'utf8');
		}
	})
	akash.on('close',()=>{
		console.log(new Date()+':: akash was closed')
		//restart
		if(is455200){
			console.log('455200 made us close, hopefully restart gracefully...')
			akashVersion = '/usr/akash/bin/akash';
			is455200 = false;
			startAkash();
		}
		else{
			startAkash();
		}
		
	})
	//kill every 4 hours
	timeout = setTimeout(()=>{
		console.log(new Date()+':: manual kill akash')
		const pk = spawn('pkill',['-9','akash']);
	},60*1000*60*4);
}
