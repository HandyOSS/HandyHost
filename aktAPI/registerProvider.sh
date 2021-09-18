#!/bin/bash
##register akash provider
## $1 = pw, $2 walletKeyName, $3 create || update, $4 fees
export AKASH_NET="https://raw.githubusercontent.com/ovrclk/net/master/mainnet"
export AKASH_VERSION="$(curl -s "$AKASH_NET/version.txt")"
export AKASH_CHAIN_ID="$(curl -s "$AKASH_NET/chain-id.txt")"
export AKASH_NODE="$(curl -s "$AKASH_NET/rpc-nodes.txt" | shuf -n 1)"
export AKASH_MONIKER="$(cat ~/.HandyHost/aktData/moniker)"

(echo "$1") | $HOME/.HandyHost/aktData/bin/akash tx provider $3 $HOME/.HandyHost/aktData/provider.yaml --from "$2" --home=$HOME/.akash --keyring-backend=file --node=$AKASH_NODE --chain-id=$AKASH_CHAIN_ID --fees "${4}uakt" --gas auto -y
