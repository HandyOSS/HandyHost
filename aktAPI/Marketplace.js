import {spawn} from 'child_process';
import {EnvUtils} from './envUtils.js';
export class Marketplace{
	constructor(){
		this.envUtils = new EnvUtils();
	}
	getOrders(params){
		return new Promise((resolve,reject)=>{
			console.log('get orders params',params);
			const orderLimit = typeof params.limit == "undefined" ? 25 : params.limit;
			let args = ['query', 'market', 'order', 'list', '--state', 'open','--limit',orderLimit,'--output','json','--count-total'];
			if(typeof params.page != "undefined"){
				args.push('--page',params.page)
			}
			const s = spawn('./bin/akash',args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
			let output = '';
			let errOut = '';
			s.stdout.on('data',d=>{
				output += d.toString();
			})
			s.stderr.on('data',d=>{
				console.log('error',d.toString());
				errOut += d.toString();
			});
			s.on('close',()=>{
				if(errOut != ''){
					reject({error:errOut});
				}
				else{
					let json = {};
					try{
						json = JSON.parse(output);
					}
					catch(e){
						reject({error:output})
					}
					resolve(json);
				}
			})
		});
	}
	getBids(params,wallet){
		return new Promise((resolve,reject)=>{
			console.log('get orders params',params);
			const orderLimit = typeof params.limit == "undefined" ? 25 : params.limit;
			let args = ['query', 'market', 'bid', 'list', '--limit', orderLimit, '--output', 'json', '--provider', wallet, '--count-total'];
			if(typeof params.page != "undefined"){
				args.push('--page',params.page)
			}
			if(typeof params.state != "undefined"){
				args.push('--state',params.state);
			}
			const s = spawn('./bin/akash',args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
			let output = '';
			let errOut = '';
			s.stdout.on('data',d=>{
				output += d.toString();
			})
			s.stderr.on('data',d=>{
				console.log('error',d.toString());
				errOut += d.toString();
			});
			s.on('close',()=>{
				if(errOut != ''){
					reject({error:errOut});
				}
				else{
					let json = {};
					try{
						json = JSON.parse(output);
					}
					catch(e){
						reject({error:output})
					}
					resolve(json);
				}
			})
		});
	}
	getLeases(params,wallet){
		return new Promise((resolve,reject)=>{
			console.log('get leases params',params);
			const orderLimit = typeof params.limit == "undefined" ? 25 : params.limit;
			let args = ['query', 'market', 'lease', 'list', '--limit', orderLimit, '--output', 'json', '--provider', wallet, '--count-total'];
			if(typeof params.page != "undefined"){
				args.push('--page',params.page)
			}
			if(typeof params.state != "undefined"){
				args.push('--state',params.state);
			}
			const s = spawn('./bin/akash',args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
			let output = '';
			let errOut = '';
			s.stdout.on('data',d=>{
				output += d.toString();
			})
			s.stderr.on('data',d=>{
				console.log('error',d.toString());
				errOut += d.toString();
			});
			s.on('close',()=>{
				if(errOut != ''){
					reject({error:errOut});
				}
				else{
					let json = {};
					try{
						json = JSON.parse(output);
					}
					catch(e){
						reject({error:output})
					}
					resolve(json);
				}
			})
		});
	}
	getCurrentChainHeight(){
		return new Promise((resolve,reject)=>{
			let output = '';
			const p = spawn('./bin/akash',['status'],{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'})
			p.stdout.on('data',d=>{
				output += d.toString();
			})
			p.stderr.on('data',d=>{
				console.log('error fetching chain',d.toString())
			})
			p.on('close',()=>{
				let json = {};
				let height = -1;
				try{
					json = JSON.parse(p);
				}
				catch(e){

				}
				if(typeof json['SyncInfo'] != "undefined"){
					height = parseInt(json['SyncInfo']['latest_block_height']);
				}
				resolve(height);
			})
		});
	}
	createBid(params,walletName){
		/*
		const params = {
			pw:$('#marketplacePW').val(),
			price:$('#price').val(),
			deposit:$('#deposit').val(),
			orderData
		};
		*/
		return new Promise((resolve,reject)=>{
			/*
			(echo "$1";) | ./bin/akash tx market bid create \
			--deposit $2 \
			--price $3 \
			--dseq $4 \
			--gseq $5 \
			--oseq $6 \
			--fees $7 \
			--gas auto \
			--keyring-backend file \
			--from $8
			--node $AKASH_NODE \
			--owner $9 \
			$P10
			*/
			const args = [
				'./placeBid.sh',
				params.pw,
				(params.deposit+'uakt' || '50000000uakt'),
				(params.price+'uakt' || '1uakt'),
				params.orderData.order_id.dseq,
				params.orderData.order_id.gseq,
				params.orderData.order_id.oseq,
				'10000uakt',
				walletName,
				params.orderData.order_id.owner
			]
			console.log('args',args);
			this.getCurrentChainHeight().then(height=>{
				if(height >= 0){
					let defaultExpiry = 7200;
					if(typeof params.bidTTL != "undefined"){
						defaultExpiry = params.bidTTL
					}
					args.push(
						(height + defaultExpiry)
					);
				}
				//now finish
				const p = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
				let output = '';
				let errOut = '';
				p.stdout.on('data',d=>{
					output += d.toString();
					console.log('bid create output',d.toString());
				})
				p.stderr.on('data',d=>{
					errOut += d.toString();
					console.log('err bid output',d.toString());
				})
				p.on('close',()=>{
					let json = {};
					try{
						json = JSON.parse(output);
					}
					catch(e){

					}

					if(Object.keys(json).length == 0){
						resolve({success:false,error:true,message:output+'; '+errOut})
					}
					else{
						if(json.codespace == '' && json.code == 0){
							resolve({success:true,message:'Successfully created bid.'})
						}
						if(json.codespace == 'sdk'){
							resolve({success:false,error:true,message:json.raw_log})
						}
						
					}
					
				})
			})
		})
		
	}
	cancelBid(params,walletName){
		/*
		const params = {
			pw:$('#marketplacePW').val(),
			price:$('#price').val(),
			deposit:$('#deposit').val(),
			orderData
		};
		*/
		return new Promise((resolve,reject)=>{
			/*
			#!/bin/bash

			(echo "$1";) | ./bin/akash tx market bid cancel \
			--dseq $2 \
			--gseq $3 \
			--oseq $4 \
			--fees $5 \
			--gas auto \
			--keyring-backend file \
			--from $6 \
			--node $AKASH_NODE \
			--owner $7 \
			-y

			*/
			const args = [
				'./cancelBid.sh',
				params.pw,
				params.orderData.order_id.dseq,
				params.orderData.order_id.gseq,
				params.orderData.order_id.oseq,
				'10000uakt',
				walletName,
				params.orderData.order_id.owner,
				params.orderData.order_id.provider
			]
			console.log('args',args);
			const p = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
			let output = '';
			let errOut = '';
			p.stdout.on('data',d=>{
				output += d.toString();
				console.log('bid cancel output',d.toString());
			})
			p.stderr.on('data',d=>{
				errOut += d.toString();
				console.log('err bid output',d.toString());
			})
			p.on('close',()=>{
				let json = {};
				try{
					json = JSON.parse(output);
				}
				catch(e){

				}

				if(Object.keys(json).length == 0){
					resolve({success:false,error:true,message:output+'; '+errOut})
				}
				else{
					if(json.codespace == '' && json.code == 0){
						resolve({success:true,message:'Successfully closed bid.'})
					}
					if(json.codespace == 'sdk'){
						resolve({success:false,error:true,message:json.raw_log})
					}
					
				}
				
			})
		
		})
	}
	fetchAllOrderBids(bid,params){
		////bid.bid.bid_id.owner+'/'+bid.bid.bid_id.dseq+'/'+bid.bid.bid_id.gseq+'/'+bid.bid.bid_id.oseq;
		return new Promise((resolve,reject)=>{
			console.log('get all bids params',bid,params);
			const orderLimit = typeof params.limit == "undefined" ? 25 : params.limit;
			let args = ['query', 'market', 'bid', 'list','--owner',bid.bid.bid_id.owner,'--dseq',bid.bid.bid_id.dseq,'--gseq',bid.bid.bid_id.gseq,'--oseq',bid.bid.bid_id.oseq,'--limit',orderLimit,'--output','json','--count-total'];
			if(typeof params.page != "undefined"){
				args.push('--page',params.page)
			}
			const s = spawn('./bin/akash',args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
			let output = '';
			let errOut = '';
			s.stdout.on('data',d=>{
				output += d.toString();
			})
			s.stderr.on('data',d=>{
				console.log('error',d.toString());
				errOut += d.toString();
			});
			s.on('close',()=>{
				if(errOut != ''){
					reject({error:errOut});
				}
				else{
					let json = {};
					try{
						json = JSON.parse(output);
					}
					catch(e){
						reject({error:output})
					}
					resolve(json);
				}
			})
		});
	}

}