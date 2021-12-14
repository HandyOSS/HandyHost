const spawn = require('child_process').spawn;
const fs = require('fs');
const url = require('url');
const path = require('path');
const redis = require('redis');
const http = require('http');
const luaScript = fs.readFileSync(__dirname+'/getAggregates.lua','utf8');

//port for aggregates http requests
const aggregatesPORT = process.env.AGGREGATES_PORT || 26659;

function start(){
	const client = redis.createClient({
		scripts: {
	      getaggs: redis.defineScript({
	        NUMBER_OF_KEYS: 1,
	        SCRIPT:luaScript,
	        transformArguments:(wal)=>{
	        	return [wal];
	        },
	        transformReply:(reply)=>{
	        	return reply;
	        }
	      })
	    }
	});
	client.connect();
	const httpServer = http.createServer(function(request, response) { 

		//handleServerRequest(request,response);
		const unsafe = url.parse(request.url).pathname;
		const safe = path.normalize(unsafe).replace(/^(\.\.(\/|\\|$))+/, '');
		const parts = safe.split('/').filter(d=>{
			return d.trim() != '';
		});
		if(parts[0].indexOf('akash') != 0){
			response.writeHead(404, {"Content-Type": "text/plain"});
			response.write('{}');
			response.end();
		}
		else{
			client.getaggs(parts[0]).then((res)=>{
				response.writeHead(200,{'Content-Type':'application/json'});
				response.write(res);
				response.end();
			}).catch(error=>{
				response.writeHead(404, {"Content-Type": "text/plain"});
				response.write(error);
				response.end();
			})
		}
	}).listen(aggregatesPORT);
}
exports.start = start;