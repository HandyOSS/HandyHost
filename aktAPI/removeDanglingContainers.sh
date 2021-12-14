#!/usr/bin/env bash

# https://github.com/ovrclk/akash/issues/1353#issuecomment-908540195
# https://github.com/ovrclk/akash/issues/1353#issuecomment-943412664

#source "{{provider_akash_env_sh}}"

export AKASH_NET="https://raw.githubusercontent.com/ovrclk/net/master/mainnet"
export AKASH_NODE="$(curl -s "$AKASH_NET/rpc-nodes.txt" | shuf -n 1)"
export AKASH_CHAIN_ID="$(curl -s "$AKASH_NET/chain-id.txt")"
export AKASH_ACCOUNT_ADDRESS="$1"

export KUBECONFIG="$HOME/.HandyHost/aktData/admin.conf"

md_pfx="akash.network"
md_lid="$md_pfx/lease.id"
md_nsn="$md_pfx/namespace"

jqexpr="[.[\"$md_nsn\"],.[\"$md_lid.owner\"],.[\"$md_lid.dseq\"],.[\"$md_lid.gseq\"],.[\"$md_lid.oseq\"],.[\"$md_lid.provider\"]]"

nsdata(){
  kubectl get ns -l "$md_pfx=true,$md_lid.provider" \
    -o jsonpath='{.items[*].metadata.labels}'
}

ldata(){
  jq -rM "$jqexpr | @tsv"
}

nsdata | ldata | while read -r line; do
  ns="$(echo "$line" | awk '{print $1}')"
  owner="$(echo "$line" | awk '{print $2}')"
  dseq="$(echo "$line" | awk '{print $3}')"
  gseq="$(echo "$line" | awk '{print $4}')"
  oseq="$(echo "$line" | awk '{print $5}')"
  prov="$(echo "$line" | awk '{print $6}')"

  state=$("$HOME/.HandyHost/aktData/bin/akash" query market lease get \
    --owner "$owner" \
    --dseq  "$dseq" \
    --gseq  "$gseq" \
    --oseq  "$oseq" \
    --provider "$prov" \
    -o yaml \
    | jq -r '.lease.state' \
  )

  if [ "$state" == "closed" ]; then
    echo kubectl delete ns "$ns" --wait=false
    echo kubectl delete providerhosts -n lease \
      --selector="$md_lid.owner=$owner,$md_lid.dseq=$dseq,$md_lid.gseq=$gseq,$md_lid.oseq=$oseq" \
      --wait=false
  fi
done