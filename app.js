import http from 'http';
import https from 'https';
import url from 'url';
import path from 'path';
import fs from 'fs';
import {APIHelper} from './api.js';
import {spawn} from 'child_process';
import {CommonUtils} from './CommonUtils.js';

const api = new APIHelper();
const utils = new CommonUtils();
const port = process.env.HANDYHOST_PORT || 8008;
const httpsPort = process.env.HANDYHOST_SSL_PORT || 58008;
fs.writeFileSync(process.env.HOME+'/.HandyHost/handyhost.pid',process.pid.toString(),'utf8');
if(!fs.existsSync(process.env.HOME+'/.HandyHost/handyhost_server.key')){
  //generate certs
  utils.getIPForDisplay().then(ipData=>{
    const args = [
      'req',
      '-x509', 
      '-out', 
      process.env.HOME+'/.HandyHost/handyhost_server.crt',
      '-keyout', 
      process.env.HOME+'/.HandyHost/handyhost_server.key',
      '-newkey',
      'rsa:2048', 
      '-nodes', 
      '-sha256',
      '-extensions',
      'EXT',
      '-subj',
      '/CN=HandyHost',
      '-config',
      'handyhost_server.cnf'
    ];
    const gencert = spawn('openssl',args)
    gencert.on('close',()=>{
      startHttpsServer();
    })
  });
}
else{
  //start ssl server
  startHttpsServer();
}

const httpServer = http.createServer(function(request, response) { 
  handleServerRequest(request,response);
}).listen(parseInt(port, 10));


api.initSocketConnection(httpServer);
function startHttpsServer(){
  const options = {
    key: fs.readFileSync(process.env.HOME+'/.HandyHost/handyhost_server.key'),
    cert: fs.readFileSync(process.env.HOME+'/.HandyHost/handyhost_server.crt')
  };
  const httpsServer = https.createServer(options,function(request, response) { 
    handleServerRequest(request,response);
  }).listen(parseInt(httpsPort, 10));
  api.initSocketConnection(httpsServer);
}

function handleServerRequest(request,response){
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
}


//console.log("NOTIFICATION: HandyHost Running at: http://localhost:" + port + "/\n");
utils.getIPForDisplay().then(data=>{
  if(process.platform == 'darwin'){
    console.log("NOTIFICATION: HandyHost Daemon is Running at: http://"+data.ip+":" + data.port + "/, and https://"+data.ip+":"+httpsPort+'/ (self-signed cert)');
    console.log('To stop the daemon, open a terminal and run: ')
    console.log('kill '+fs.readFileSync(process.env.HOME+'/.HandyHost/handyhost.pid','utf8'))
  }
  
  console.log("HandyHost Daemon Running at: http://"+data.ip+":" + data.port + "/, and https://"+data.ip+":"+httpsPort+'/ (self-signed cert)');
})


process.on('uncaughtException', function(err) {
  if(err.code.indexOf('EADDRINUSE') >= 0){
    utils.getIPForDisplay().then(data=>{
      if(process.platform == 'darwin'){
        console.log("NOTIFICATION: HandyHost Daemon Already Running at: http://"+data.ip+":" + data.port + "/ and https://"+data.ip+":"+httpsPort+' (self-signed cert)');
        console.log('To stop the daemon, open a terminal and run: ')
        console.log('kill '+fs.readFileSync(process.env.HOME+'/.HandyHost/handyhost.pid','utf8'))
      }
      console.log("HandyHost Daemon Already Running at: http://"+data.ip+":" + data.port + "/ and https://"+data.ip+":"+httpsPort+' (self-signed cert)');
      process.exit(1);
    })
  }
  else{
    console.log('Caught exception: ' + err);
    process.exit(1);
  }
  
});
