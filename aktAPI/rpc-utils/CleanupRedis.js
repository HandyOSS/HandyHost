const redis = require('redis');

const luaScript = fs.readFileSync(__dirname+'/cleanup.lua','utf8');

function cleanup(){
	const client = redis.createClient({
		scripts: {
	      cleanup: redis.defineScript({
	        NUMBER_OF_KEYS: 0,
	        SCRIPT:luaScript,
	        transformArguments:()=>{
	        	return [];
	        },
	        transformReply:(reply)=>{
	        	return reply;
	        }
	      })
	    }
	});
	client.connect();
	client.cleanup().then((res)=>{
		console.log('cleanup complete',res);
	});
}

exports.cleanup = cleanup;