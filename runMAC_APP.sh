#!/bin/bash

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
[ -s "/usr/local/opt/nvm/nvm.sh" ] && \. "/usr/local/opt/nvm/nvm.sh" && \
[ -s "/usr/local/opt/nvm/etc/bash_completion.d/nvm" ] && \. "/usr/local/opt/nvm/etc/bash_completion.d/nvm" && \
echo -n > "$HOME/.HandyHost/handyhost.log" && \
cd $PWD/HandyHost && \
nvm use && \
nohup node app.js > $HOME/.HandyHost/handyhost.log 2>&1 & \
echo "LAUNCHING..." && \
sleep 5 && \
echo "$(cat $HOME/.HandyHost/handyhost.log)" && \
exit 0