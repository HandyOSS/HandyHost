#!/bin/bash
(echo "$2"; echo "$1"; echo "$1";) | \
docker run --rm \
--interactive \
--volume ${HOME}/.sentinelnode:/root/.sentinelnode \
sentinel-dvpn-node process keys add $3 --recover 