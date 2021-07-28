#!/bin/bash
##create provider certificate
## $1 walletName, $2 provider domain,
export AKASH_NET="https://raw.githubusercontent.com/ovrclk/net/master/mainnet"
export AKASH_VERSION="$(curl -s "$AKASH_NET/version.txt")"
export AKASH_CHAIN_ID="$(curl -s "$AKASH_NET/chain-id.txt")"
export AKASH_NODE="$(curl -s "$AKASH_NET/rpc-nodes.txt" | shuf -n 1)"
export AKASH_MONIKER="$(cat $HOME/.HandyHost/aktData/moniker)"

./bin/akash tx cert create server $2 \
--chain-id $AKASH_CHAIN_ID \
--keyring-backend file \
--from $1 \
--home=$HOME/.akash \
--node=$AKASH_NODE \
--fees 10000uakt \
--gas auto \
--rie