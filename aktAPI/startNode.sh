#!/bin/bash
#not used because we're not validators but leaving just in case..
export AKASH_NET="https://raw.githubusercontent.com/ovrclk/net/master/mainnet"
export AKASH_VERSION="$(curl -s "$AKASH_NET/version.txt")"
export AKASH_CHAIN_ID="$(curl -s "$AKASH_NET/chain-id.txt")"
export AKASH_NODE="$(curl -s "$AKASH_NET/rpc-nodes.txt" | shuf -n 1)"
export AKASH_MONIKER="$(cat ~/.HandyHost/aktData/moniker)"
echo "running akash node" && \
$HOME/.HandyHost/aktData/bin/akash start

