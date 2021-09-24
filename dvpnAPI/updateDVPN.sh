#!/bin/bash
#udpate dvpn-node
cd ${HOME}/.HandyHost/sentinelData/dvpn-node && \
git fetch --all && \
git checkout "$1" && \
docker build --file Dockerfile \
--tag sentinel-dvpn-node \
--force-rm \
--no-cache \
--compress .