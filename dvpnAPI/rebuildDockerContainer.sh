#!/bin/bash
USERNAME="$USER"
USERHOME="$(eval echo ~$USERNAME)"

#cp ./Dockerfile-hnsdfix ${USERHOME}/.HandyHost/sentinelData/dvpn-node/Dockerfile && \
cd ${USERHOME}/.HandyHost/sentinelData/dvpn-node && \
git stash && \
git fetch --all && \
git checkout "$1" && \
docker build --file ${USERHOME}/.HandyHost/sentinelData/dvpn-node/Dockerfile \
  --tag sentinel-dvpn-node \
  --force-rm \
  --no-cache \
  --compress ${USERHOME}/.HandyHost/sentinelData/dvpn-node/