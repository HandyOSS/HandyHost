#!/bin/bash
HANDYHOST_DIR=$PWD
UPDATED_DIR="$HOME/.HandyHost/HandyHostUpdate"
HANDYHOST_PID=$3
USERHOME="$HOME"

if [[ -s "$HOME/.bash_profile" ]] ; then
	source "$HOME/.bash_profile"
fi
if [[ -s "$HOME/.profile" ]] ; then
	source "$HOME/.profile"
fi
if [[ -s "$HOME/.bashrc" ]] ; then
	source "$HOME/.bashrc"
fi

[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion


if [[ -s /var/log/handyhost.pid ]]; then
	HANDYHOST_PID=$(cat /var/log/handyhost.pid)
fi
if [[ -z "${HANDYHOST_PRIVATE_REPO_TOKEN+x}" ]]; then
	#not a private repo anymore yay
	URL="https://github.com/HandyMiner/HandyHost"
else 
	URL="https://$HANDYHOST_PRIVATE_REPO_TOKEN@github.com/HandyMiner/HandyHost"
fi
if [[ -d "$UPDATED_DIR" ]] ; then
	rm -rf "$UPDATED_DIR"
fi
mkdir -p "$UPDATED_DIR" && \
cd "$UPDATED_DIR" && \
git clone $URL . && \
git checkout "$1" && \
#skip rebuilding sqlite3 if we can.....
cp -r "$HANDYHOST_DIR/node_modules" "$UPDATED_DIR/node_modules" && \
mv "$UPDATED_DIR/update.sh" "$UPDATED_DIR/update.new.sh" && \

if [[ -s "$UPDATED_DIR/update_dependencies.sh" ]] ; then
	#in case we updated any brew or apt packages...
	/bin/bash "$UPDATED_DIR/update_dependencies.sh"
fi

if [[ -d "$USERHOME/.nvm" ]] ; then
	#has nvm
	nvm install $(cat $UPDATED_DIR/.nvmrc) && \
	nvm use
fi
npm install --build-from-source --python=/usr/bin/python3 && \
cd client && bower install && cd $UPDATED_DIR && \
cp -r "$UPDATED_DIR/." "$HANDYHOST_DIR" && \
rm -rf "$HOME/.HandyHost/HandyHostUpdate" && \
cd "$HANDYHOST_DIR" && \
echo "restarting handyhost" && \
sleep 2 && \

if [[ -s "/etc/init.d/handyhost" ]] ; then
	sudo systemctl restart handyhost
	#if type forever > /dev/null 2>&1; then
  		#forever exists, kill with forever
  		#forever stop $HANDYHOST_PID
else
	if [[ -s "$HOME/.HandyHost/handyhostDaemon.pid" ]] ; then
		NODE_NO_WARNINGS=1 forever restart "$(cat $HOME/.HandyHost/handyhostDaemon.pid)" > /dev/null && \
		echo "HandyHost Restarted"
	fi
fi

mv "$HANDYHOST_DIR/update.new.sh" "$HANDYHOST_DIR/update.sh" && \
exit 0

