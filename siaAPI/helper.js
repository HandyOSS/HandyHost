import http from 'http';
import fs from 'fs';
export const siacCommand = (endpoint,requestType,useAuth) => {
	return new Promise((resolve,reject)=>{
		const options = {
			host: 'localhost',
			port:'9980',
			path: '/'+endpoint,
			headers : {
				'User-Agent': 'Sia-Agent'
			},
			method:requestType
		};
		if(useAuth){
			const apiPass = fs.readFileSync(process.env.HOME+'/.sia/apipassword','utf8').replace('\n','');
			options.headers['Authorization'] = `Basic ${new Buffer.from(':'+apiPass).toString('base64')}`;
		}
		
		let output = '';
		const request = http.request(options,response=>{
			//another chunk of data has been received, so append it to `str`
			
			response.on('data', (chunk) => {
				output += chunk;
			});

			//the whole response has been received, so we just print it out here
			response.on('end', () => {
				let json = [];
				try{
					json = JSON.parse(output);
				}
				catch(e){
					console.log('bad json response',output.toString());
				}

				resolve(json);

			});

			if(response.statusCode.toString() != '200'){
				//something went wrong
				reject(output);
			}
		});

		request.on('error', (err)=> {
		    reject(err)
		});
		request.end();
	})
}

export const siacPostDataCommand = (endpoint,dataStr) =>{
	const postData = dataStr;
	const apiPass = fs.readFileSync(process.env.HOME+'/.sia/apipassword','utf8').replace('\n','');
	
	return new Promise((resolve,reject)=>{
		const options = {
			host: 'localhost',
			port:'9980',
			path: '/'+endpoint,
			headers : {
				'User-Agent': 'Sia-Agent',
				'Content-Length': Buffer.byteLength(postData,'utf8'),
				'Content-Type': 'application/x-www-form-urlencoded',
				'Authorization': `Basic ${new Buffer.from(':'+apiPass).toString('base64')}`
			},
			method:'POST'
		};
		//console.log('d',options.headers);
		let output = '';
		const request = http.request(options,response=>{
			//another chunk of data has been received, so append it to `str`
			
			response.on('data', (chunk) => {
				output += chunk;
			});

			//the whole response has been received, so we just print it out here
			response.on('end', () => {
				let json = [];
				try{
					json = JSON.parse(output);
				}
				catch(e){
					console.log('no json response');
				}

				resolve(json);

			});
			if(response.statusCode.toString() != '200'){
				//something went wrong
				console.log('status not 200',response.statusCode,response.statusMessage);
				if(response.statusCode == 490){
					console.log('status code is 490'); //on wallet unlock fail (beat daemon to setup) we get a 490. client should retry
					reject(response.statusCode);
				}
				//reject(output);
			}
		});
		request.on('error', (err)=> {
			console.log('error',err);
		    reject(err)
		});
		request.write(postData);
		request.end();
	})
}