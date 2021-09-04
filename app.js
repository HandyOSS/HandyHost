import http from 'http';
import url from 'url';
import path from 'path';
import fs from 'fs';
import {APIHelper} from './api.js';
import {spawn} from 'child_process';

const api = new APIHelper();
const port = process.env.PORT || 8008;

const httpServer = http.createServer(function(request, response) {
  
  const unsafe = url.parse(request.url).pathname;
  const safe = path.normalize(unsafe).replace(/^(\.\.(\/|\\|$))+/, '');
  
  let filename = path.resolve()+'/client'+safe;
  
  const contentTypesByExtension = {
    //whitelist things here
    '.html': "text/html",
    '.css':  "text/css",
    '.js':   "text/javascript",
    '.png':  "image/png",
    '.svg': 'image/svg+xml',
    '.mjs': 'text/javascript',
    '.ttf': 'font/ttf'
  };
  fs.exists(filename, function(exists) {
    if(!exists) {
      //might be a request for us to get some data, lets see here..
      let body = "";
      request.on('data', function (chunk) {
        body += chunk;
      });
      request.on('end', function () {
        api.get(safe,body).then(data=>{
          if(typeof data == 'string'){
            response.end(data);
          }
          else{
            response.end(JSON.stringify(data));
          }
        }).catch(err=>{
          response.writeHead(404, {"Content-Type": "text/plain"});
          let out = '{}';
          try{
            out = JSON.stringify(err);
          }
          catch(e){
            out = JSON.stringify({error:err});
          }
          response.write(out);
          response.end();
        });
      });

      
      return;
    }

    if (fs.statSync(filename).isDirectory()) filename += '/index.html';

    fs.readFile(filename, "binary", function(err, file) {
      if(err) {        
        response.writeHead(500, {"Content-Type": "text/plain"});
        response.write(err + "\n");
        response.end();
        return;
      }

      const headers = {};
      const contentType = contentTypesByExtension[path.extname(filename)];
      if (contentType) headers["Content-Type"] = contentType;
      response.writeHead(200, headers);
      response.write(file, "binary");
      response.end();
    });
  });
}).listen(parseInt(port, 10));
api.initSocketConnection(httpServer);
function getIPForDisplay(){
  return new Promise((resolve,reject)=>{
    let getIPCommand;
    let getIPOpts;
    let ipCommand;
    let ipRangeOut;
    
    if(process.platform == 'darwin'){
      getIPCommand = 'ipconfig';
      getIPOpts =  ['getifaddr', 'en0'];
    }
    if(process.platform == 'linux'){
      //hostname -I [0]
      getIPCommand = 'hostname';
      getIPOpts = ['-I'];
    }

    ipCommand = spawn(getIPCommand,getIPOpts); 
    ipCommand.stdout.on('data',d=>{
      ipRangeOut = d.toString('utf8').trim();
    });
    ipCommand.on('close',()=>{
      if(process.platform == 'linux'){
        ipRangeOut = ipRangeOut.split(' ')[0];
      }
      resolve(ipRangeOut);
    });
  });
  
}
//console.log("NOTIFICATION: HandyHost Running at: http://localhost:" + port + "/\n");
getIPForDisplay().then(ip=>{
  console.log("NOTIFICATION: HandyHost Running at: http://"+ip+":" + port + "/\n");
  console.log("HandyHost Running at: http://"+ip+":" + port + "/\n");
})


process.on('uncaughtException', function(err) {
  if(err.code.indexOf('EADDRINUSE') >= 0){
    getIPForDisplay().then(ip=>{
      console.log("NOTIFICATION: HandyHost Already Running at: http://"+ip+":" + port + "/\n");
      console.log("HandyHost Already Running at: http://"+ip+":" + port + "/\n");
      process.exit(1);
    })
  }
  else{
    console.log('Caught exception: ' + err);
    process.exit(1);
  }
  
});
