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
let badAttempts = 0;
let lastBadAttempt = Math.floor(new Date().getTime()/1000);
let lastBadAttemptTimeout;
if(!fs.existsSync(process.env.HOME+'/.HandyHost/handyhost_server.key')){
  //generate certs
  //utils.getIPForDisplay().then(ipData=>{
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
  //});
}
else{
  //start ssl server
  startHttpsServer();
}
utils.initKeystore();
utils.initJWTKey();

const httpServer = http.createServer(function(request, response) { 
  handleServerRequest(request,response);
}).listen(parseInt(port, 10));


api.initSocketConnection(httpServer,'http');
function startHttpsServer(){
  const options = {
    key: fs.readFileSync(process.env.HOME+'/.HandyHost/handyhost_server.key'),
    cert: fs.readFileSync(process.env.HOME+'/.HandyHost/handyhost_server.crt')
  };
  const httpsServer = https.createServer(options,function(request, response) { 
    handleServerRequest(request,response);
  }).listen(parseInt(httpsPort, 10));
  api.initSocketConnection(httpsServer,'https');
}

var get_cookies = function(request) {
  var cookies = {};
  request.headers && request.headers.cookie.split(';').forEach(function(cookie) {
    var parts = cookie.match(/(.*?)=(.*)$/)
    cookies[ parts[1].trim() ] = (parts[2] || '').trim();
  });
  return cookies;
};

function handleServerRequest(request,response){
  let authTokenCookies = {};
  try{
    authTokenCookies = get_cookies(request);
  }
  catch(e){
    //console.log('error with cookies',e);
  }
  
  const authToken = typeof authTokenCookies['handyhostToken'] == "undefined" ? "bust" : authTokenCookies['handyhostToken'];
  
  const unsafe = url.parse(request.url).pathname;
  const safe = path.normalize(unsafe).replace(/^(\.\.(\/|\\|$))+/, '');
  //ok check if we enabled auth for the server
  const isAuthEnabled = utils.isAuthEnabled();
  let isAuthValid = true;
  if(isAuthEnabled){
    //and if we did, is our token valid
    isAuthValid = utils.checkAuthToken(authToken);
  }
  if(isAuthValid){
    if(safe.indexOf('/api/login') == 0){
      //document.cookie and fetch cookie are out of fn sync for whatever reason, let them know for a bump
      response.setHeader('Set-Cookie', ["handyhostToken="+authToken]);
      response.write('{"success":true,"token":"'+authToken+'"}');
      response.end();
      badAttempts = 0;
      return;
    } 

    //proceed
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
  else{
    //no valid auth token and auth is valid
    const now = Math.floor(new Date().getTime()/1000);
    if( (now - lastBadAttempt > 60) || badAttempts >= 6){
      badAttempts = 0;
    }
    console.log('bad login attempts',badAttempts, 'seconds since last attempt', now - lastBadAttempt);
    
    if(badAttempts >= 5){
      if(typeof lastBadAttemptTimeout != "undefined"){
        clearTimeout(lastBadAttemptTimeout);
      }
    }
    lastBadAttemptTimeout = setTimeout(()=>{
      if(safe.indexOf('/api') == 0){
        //first check if this is a login or change password
        if(safe.indexOf('/api/login') == 0 || safe.indexOf('/api/passwordreset') == 0){
          //do login
          let body = "";
          request.on('data', function (chunk) {
            body += chunk;
          });
          request.on('end', function () {
            let creds = {};
            try{
              creds = JSON.parse(body);
            }
            catch(e){
              console.log('eror parsing creds',e);
            }
            if(safe.indexOf('/api/passwordreset') == 0){
              //its a reset or init
              utils.changeAuth(creds.newpw,creds.oldpw).then(wasSuccessful=>{
                console.log('password was reset successful',wasSuccessful);
                if(wasSuccessful){
                  //respond
                  utils.bumpToken().then(token=>{
                    response.setHeader('Set-Cookie', ["handyhostToken="+token]);
                    response.write('{"success":true,"token":"'+token+'"}');
                    response.end();
                    badAttempts = 0;
                    return;
                  })
                }
                else{
                  //fail
                  response.writeHead(401, {"Content-Type": "application/json"});
                  response.write('{"success":false,"message":"incorrect password"}');
                  response.end();
                }
              })
            }
            else{
              //its login
              utils.checkAuth(creds.pw).then(wasSuccessful=>{
                if(wasSuccessful){
                  //respond
                  utils.bumpToken().then(token=>{
                    response.setHeader('Set-Cookie', ["handyhostToken="+token]);
                    response.write('{"success":true,"token":"'+token+'"}');
                    response.end();
                    badAttempts = 0;
                    return;
                  })
                }
                else{
                  //fail
                  response.writeHead(401, {"Content-Type": "application/json"});
                  response.write('{"success":false,"message":"incorrect password"}');
                  response.end();
                }
              })
            }
          });
          
        }
        else{
          response.writeHead(401, {"Content-Type": "text/plain"});
          response.write("unauthorized\n");
          response.end();
          return;
        }
        //is an api request, throw a 401
        
      }
      else{
        fs.readFile(path.resolve()+'/client/login.html', "binary", function(err, file) {
          if(err) {        
            response.writeHead(500, {"Content-Type": "text/plain"});
            response.write(err + "\n");
            response.end();
            return;
          }
          const headers = {};
          const isNew = utils.hasDefaultAuth();
          if(isNew){
            file = file.replace(/__FORMMODE__/gi,'new');
          }
          else{
            file = file.replace(/__FORMMODE__/gi,'login')
          }

          const contentType = 'text/html';
          if (contentType) headers["Content-Type"] = contentType;
          response.writeHead(200, headers);
          response.write(file, "binary");
          response.end();
        });
      }
    },2500 * badAttempts);

    lastBadAttempt = now;
    badAttempts += 1;
    
  }
  
}


//console.log("NOTIFICATION: HandyHost Running at: http://localhost:" + port + "/\n");
utils.getIPForDisplay().then(data=>{
  if(process.platform == 'darwin'){
    fs.writeFileSync(process.env.HOME+'/.HandyHost/handyhost.pid',process.pid.toString(),'utf8');
    const startupLog = process.env.HOME+'/.HandyHost/startup.log';
    fs.writeFileSync(startupLog,data.ip,'utf8');
    
  }
  
  console.log("HandyHost Daemon Running at: http://"+data.ip+":" + data.port + "/, and https://"+data.ip+":"+httpsPort+'/ (self-signed cert)');
  
})


process.on('uncaughtException', function(err) {
  if(typeof err.code != "undefined"){
    if(err.code.indexOf('EADDRINUSE') >= 0){
      utils.getIPForDisplay().then(data=>{
        if(process.platform == 'darwin'){
          const startupLog = process.env.HOME+'/.HandyHost/startup.log';
          fs.writeFileSync(startupLog,data.ip,'utf8');
          
        }
        console.log("HandyHost Daemon Already Running at: http://"+data.ip+":" + data.port + "/ and https://"+data.ip+":"+httpsPort+' (self-signed cert)');
        process.exit(1);
      })
    }
    else{
      console.log('Caught exception: ' + err);
      process.exit(1);
    }
  }
  else{
    console.log('Caught exception: ' + err);
    process.exit(1);
  }
  
});
