#!/bin/bash
#####DEPRECATED#######
#####keeping it all in node to avoid moving passwords around#####
if [[ "$OSTYPE" == "darwin"* ]]; then
	OPENSSL='/usr/local/opt/openssl@1.1/bin/openssl'
else
	OPENSSL="$(which openssl)"
fi

pw=$($OPENSSL rsautl -inkey "$HOME/.HandyHost/keystore/handyhost.key" -decrypt -in $1) && \
rm $1 && \

(echo "$pw"; echo "$pw") | docker run --rm \
--interactive \
--volume ${HOME}/.sentinelnode:/root/.sentinelnode \
sentinel-dvpn-node process keys list