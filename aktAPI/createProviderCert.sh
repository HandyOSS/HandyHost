#!/bin/bash
##create provider certificate
## $1 walletName, $2 provider domain, $3 fees


$HOME/.HandyHost/aktData/bin/akash tx cert create server "$2" \
--chain-id $AKASH_CHAIN_ID \
--keyring-backend file \
--from "$1" \
--home=$HOME/.akash \
--node=$AKASH_NODE \
--fees "$3uakt" \
--gas auto \
--rie