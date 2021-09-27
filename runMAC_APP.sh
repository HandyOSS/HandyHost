#!/bin/bash

SCRIPT_DIR=$( cd ${0%/*} && pwd -P )

if [[ ! -s "$HOME/.bash_profile" && -s "$HOME/.profile" ]] ; then
  profile_file="$HOME/.profile"
else
  profile_file="$HOME/.bash_profile"
fi
if [[ -s "$HOME/.zshrc" ]] ; then
	profile_file="$HOME/.zshrc"
fi
source $profile_file
export NVM_DIR=$HOME/.nvm && \
[ -s "/usr/local/opt/nvm/nvm.sh" ] && \. "/usr/local/opt/nvm/nvm.sh" > /dev/null && \
[ -s "/usr/local/opt/nvm/etc/bash_completion.d/nvm" ] && \. "/usr/local/opt/nvm/etc/bash_completion.d/nvm" > /dev/null && \
echo -n > "$HOME/.HandyHost/handyhost.log"

if [[ ! -d "$SCRIPT_DIR/HandyHost" ]] ; then
	LAUNCH_DIR=$SCRIPT_DIR
else
	LAUNCH_DIR=$SCRIPT_DIR/HandyHost
fi

cd $LAUNCH_DIR && \
nvm use > /dev/null

if [ -z $1 ] ; then
	if [[ -s $HOME/.HandyHost/handyhostDaemon.pid ]] ; then
		echo "🟢 HandyHost is Running"
		echo "----\n"
		echo "🛑 Stop HandyHost Service"
		echo "🔃 Restart HandyHost Service"
		echo "🔓 Open HandyHost UI (http)"
		echo "🔏 Open HandyHost UI (https: self-signed certificate)"
	else
		echo "😞 HandyHost is not Running"
		echo "----\n"
		echo "🚀 Start HandyHost Service"
	fi
	
else
	IP=$(cat "$HOME/.HandyHost/startup.log")
	if [ "$1" = "🛑 Stop HandyHost Service" ] ; then
		if [[ -s "$HOME/.HandyHost/handyhostDaemon.pid" ]] || [ "$1" = "stop" ] ; then
			NODE_NO_WARNINGS=1 forever stop "$(cat $HOME/.HandyHost/handyhostDaemon.pid)" > /dev/null && \
			echo "NOTIFICATION: HandyHost Stopped"
		fi
	fi
	if [ "$1" = "🔓 Open HandyHost UI (http)" ] ; then
		open "http://$IP:8008/"
	fi
	if [ "$1" = "🔏 Open HandyHost UI (https: self-signed certificate)" ] ; then
		open "https://$IP:58008/"
	fi
	if [ "$1" = "🔃 Restart HandyHost Service" ] || [ "$1" = "restart" ] ; then
		NODE_NO_WARNINGS=1 forever restart --pidFile "$HOME/.HandyHost/handyhostDaemon.pid" -l $HOME/.HandyHost/handyhost.log -a app.js > /dev/null && \
		echo "NOTIFICATION: HandyHost Restarted"
	fi
	if [ "$1" = "🚀 Start HandyHost Service" ] || [ "$1" = "startup" ] ; then
		NODE_NO_WARNINGS=1 forever start --pidFile "$HOME/.HandyHost/handyhostDaemon.pid" -l $HOME/.HandyHost/handyhost.log -a app.js > /dev/null && \
		echo "NOTIFICATION: HandyHost Started"
	fi
	
	exit 0
fi



# if [[ -s $HOME/.HandyHost/handyhostDaemon.pid ]] ; then
# 	# NODE_NO_WARNINGS=1 forever stop $(cat $HOME/.HandyHost/handyhostDaemon.pid) > /dev/null; \
# 	# NODE_NO_WARNINGS=1 forever start --pidFile $HOME/.HandyHost/handyhostDaemon.pid -l $HOME/.HandyHost/handyhost.log -a app.js > /dev/null
# 	##echo standard menu
# 	echo "$(cat $HOME/.HandyHost/startup.log)"
# else
# 	NODE_NO_WARNINGS=1 forever start --pidFile $HOME/.HandyHost/handyhostDaemon.pid -l $HOME/.HandyHost/handyhost.log -a app.js > /dev/null && \
# 	sleep 5 && \
# 	echo "$(cat $HOME/.HandyHost/startup.log)"
# fi

#nohup node app.js > $HOME/.HandyHost/handyhost.log 2>&1 & \
#echo "LAUNCHING..." && \

exit 0