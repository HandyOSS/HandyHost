import {siacCommand, siacPostDataCommand} from './helper.js';
import https from 'https';
import fs from 'fs';
		
export class Consensus{
	constructor(){

	}
	getChainStatus(){
		return siacCommand('consensus','GET');
	}
	downloadConsensusBootstrap(ioNamespaces){
		const TIMEOUT = 10000

		const outPath = process.env.HOME+'/.HandyHost/siaData/consensusBootstrap.zip';
		const bootstrapURL = 'https://siastats.info/bootstrap/bootstrap.zip';

		const file = fs.createWriteStream(outPath)

		return new Promise(function(resolve, reject) {
			const request = https.get(bootstrapURL).on('response', function(res) {
			  const len = parseInt(res.headers['content-length'], 10)
			  let downloaded = 0
			  let percent = 0
			  res
			    .on('data', function(chunk) {
			      file.write(chunk)
			      downloaded += chunk.length
			      percent = (100.0 * downloaded / len).toFixed(2)
			      if(percent % 0.5 == 0){
			      	const bootstrapMeta = {
		      			percent,
		      			size:len,
		      			finished:downloaded,
		      			updated:new Date()
		      		};
		      		fs.writeFileSync(process.env.HOME+'/.HandyHost/siaData/consensusBootstrapProgress.json',JSON.stringify(bootstrapMeta,null,2),'utf8');
		      		
			      	Object.keys(ioNamespaces).map(serverName=>{
			      		console.log('consensus bootstrap progress',bootstrapMeta)
						ioNamespaces[serverName].namespace.to('sia').emit('consensusBootstrapProgress',bootstrapMeta);
					})
			      }
			    })
			    .on('end', function() {
			    	Object.keys(ioNamespaces).map(serverName=>{
			      		ioNamespaces[serverName].namespace.to('sia').emit('consensusBootstrapFinished');
					})
					file.end()
					console.log(`${bootstrapURL} downloaded to: ${outPath}`)
					resolve()
			    })
			    .on('error', function (err) {
					Object.keys(ioNamespaces).map(serverName=>{
						ioNamespaces[serverName].namespace.to('sia').emit('consensusBootstrapError',err);
					})
					reject(err)
			    })
			})
			request.setTimeout(TIMEOUT, function() {
			  request.abort()
			  reject(new Error(`request timeout after ${TIMEOUT / 1000.0}s`))
			})
		})
	}
}