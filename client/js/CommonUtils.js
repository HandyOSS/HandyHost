export class CommonUtils{
	constructor(){

	}
	getIP(){
		return new Promise((resolve,reject)=>{
			fetch('/api/getIP').then(d=>d.json()).then(data=>{
				resolve(data);
			})
		})
		
	}
}