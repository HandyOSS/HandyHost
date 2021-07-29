#!/bin/bash
pwd=${PWD}
echo "########## Installing HandyHost Dependencies... ##########"
curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash - && \
sudo apt-get install -y nodejs && \
sudo apt-get install -y build-essential && \
npm install --build-from-source && \
npm install -g bower && \
cd $pwd/client && \
bower install && \
mkdir -p $HOME/.HandyHost && \
echo "########## Installing Sia ##########" && \
cd $pwd/siaAPI && ./install.sh && \
echo "########## Installing DVPN ##########" && \
cd $pwd/dvpnAPI && ./installDocker.sh && ./installDVPN.sh && \
echo "########## Installing Akash ##########" && \
cd $pwd/aktAPI && ./installDependencies.sh && ./install.sh && \
echo "########## DONE INSTALLING! ##########" && \
node $pwd/rainbow.js
