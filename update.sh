#!/bin/bash
HANDYHOST_DIR=$PWD
UPDATED_DIR=$HOME/.HandyHost/HandyHostUpdate
HANDYHOST_PID=$3
if [[ -s /var/log/handyhost.pid ]]; then
	HANDYHOST_PID=$(cat /var/log/handyhost.pid)
fi
if [[ ! -z $HANDYHOST_PRIVATE_REPO_TOKEN ]]; then
	#not a private repo anymore yay
	URL="https://github.com/HandyMiner/HandyHost"
else 
	URL="https://$HANDYHOST_PRIVATE_REPO_TOKEN@github.com/HandyMiner/HandyHost"
fi
mkdir -p $UPDATED_DIR && \
cd $UPDATED_DIR && \
git clone $URL . && \
git checkout "$1" && \
#skip rebuilding sqlite3 if we can.....
cp -r $HANDYHOST_DIR/node_modules ./node_modules && \
source $USERHOME/.bashrc && \
if [[ -s "$USERHOME/.nvm" ]] ; then
	#has nvm
	nvm install $(cat $UPDATED_DIR/.nvmrc) && \
	nvm use
fi
npm install --build-from-source --python=/usr/bin/python3 && \
cd client && bower install && cd $UPDATED_DIR && \
cp -r $UPDATED_DIR/* $HANDYHOST_DIR && \
rm -rf $HOME/.HandyHost/HandyHostUpdate && \
cd $HANDYHOST_DIR && \
echo "restarting handyhost" && \
sleep 2 && \

if type forever > /dev/null 2>&1; then
  	#forever exists, kill with forever
  	forever stop $HANDYHOST_PID
else
	kill $HANDYHOST_PID
fi

sh -c "$2" & \
exit 0
