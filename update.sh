#!/bin/bash
HANDYHOST_DIR=$PWD
HANDYHOST_PID=$(cat $PWD/pid)
if [[ -s /var/log/handyhost.pid ]]; then
	HANDYHOST_PID=$(cat /var/log/handyhost.pid)
fi
if [[ ! -z $HANDYHOST_PRIVATE_REPO_TOKEN ]]; then
	#not a private repo anymore yay
	URL="https://github.com/HandyMiner/HandyHost"
else 
	URL="https://$HANDYHOST_PRIVATE_REPO_TOKEN@github.com/HandyMiner/HandyHost"
fi
mkdir -p $HOME/.HandyHost/HandyHostUpdate && \
cd $HOME/.HandyHost/HandyHostUpdate && \
git clone $URL . && \
git checkout "$1" && \
#skip rebuilding sqlite3 if we can.....
cp -r HANDYHOST_DIR/node_modules ./node_modules && \
source $USERHOME/.bashrc && \
if [[ -s "$USERHOME/.nvm" ]] ; then
	#has nvm
	nvm install $(cat $HOME/.HandyHost/HandyHostUpdate/.nvmrc) && \
	nvm use
fi
npm install --build-from-source --python=/usr/bin/python3 && \
cd client && bower install && \
cd $HANDYHOST_DIR && \
if type forever > /dev/null; then
  	#forever exists, kill with forever
  	forever stop $HANDYHOST_PID
else
	kill $HANDYHOST_PID
fi

sleep 2 && \
sh -c "$2"
