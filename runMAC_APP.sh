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
cd $PWD/HandyHost && \
nohup node app.js > $HOME/.HandyHost/handyhost.log 2>&1 & \
echo "LAUNCHED" && \
sleep 1 && \
echo "$(cat $HOME/.HandyHost/handyhost.log)" && \
exit 0