#!/bin/bash
##create provider certificate
## $1 walletName, $2 provider domain, $3 fees, $4 gas


$HOME/.HandyHost/aktData/bin/akash tx cert create server "$2" \
--chain-id $AKASH_CHAIN_ID \
--keyring-backend file \
--from "$1" \
--home=$HOME/.akash \
--node=$AKASH_NODE \
--fees "$3uakt" \
--gas "$4" \
--rie