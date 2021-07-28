#!/bin/bash
#$1 can be network...
export AKASH_NET="https://raw.githubusercontent.com/ovrclk/net/master/mainnet"
export AKASH_VERSION="$(curl -s "$AKASH_NET/version.txt")"
export AKASH_CHAIN_ID="$(curl -s "$AKASH_NET/chain-id.txt")"
export AKASH_NODE="$(curl -s "$AKASH_NET/rpc-nodes.txt" | shuf -n 1)"
# #get genesis json
# curl -s "$AKASH_NET/genesis.json" > genesis.json
# # get seed nodes
# curl -s "$AKASH_NET/seed-nodes.txt" > seeds.txt
# #get peer nodes
# curl -s "$AKASH_NET/peer-nodes.txt" > peers.txt
# #get faucet url (testnet/edgenet)
# curl -s "$AKASH_NET/faucet-url.txt" > faucet-url.txt
# #get api nodes
# curl -s "$AKASH_NET/api-nodes.txt" > api-nodes.txt
# #get rpc nodes
# curl -s "$AKASH_NET/rpc-nodes.txt" > rpc-nodes.txt

echo "installing akash software..." && \
curl https://raw.githubusercontent.com/ovrclk/akash/master/godownloader.sh | sh -s -- "v$AKASH_VERSION"

