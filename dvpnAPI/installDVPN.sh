#!/bin/bash
#install dvpn-node
source ${HOME}/.profile && \
mkdir -p ${HOME}/.HandyHost/sentinelData && \
if [[ -d ${HOME}/.HandyHost/sentinelData/dvpn-node ]] ; then
	echo "dvpn already exists, reinstalling"
	rm -rf ${HOME}/.HandyHost/sentinelData/dvpn-node
fi
git clone https://github.com/sentinel-official/dvpn-node.git ${HOME}/.HandyHost/sentinelData/dvpn-node && \
cd ${HOME}/.HandyHost/sentinelData/dvpn-node && \
commit=$(git rev-list --tags --max-count=1) && \
git checkout $(git describe --tags ${commit}) && \
docker build --file Dockerfile \
--tag sentinel-dvpn-node \
--force-rm \
--no-cache \
--compress .
