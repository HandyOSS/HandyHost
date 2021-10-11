#!/bin/bash
#params.pw,params.walletName,params.serverHost
#$1=walletName, $2 serverHost, $3 = cpuPrice, $4 = txFees
$HOME/.HandyHost/aktData/bin/akash provider run \
--home $HOME/.akash \
--chain-id $AKASH_CHAIN_ID \
--node $AKASH_NODE \
--keyring-backend file \
--from "$1" \
--fees "${4}uakt" \
--kubeconfig $HOME/.HandyHost/aktData/admin.conf \
--cluster-k8s true \
--deployment-ingress-domain $2 \
--cluster-public-hostname $2 \
--deployment-ingress-static-hosts true \
--deployment-runtime-class none \
--bid-price-strategy scale \
--bid-price-cpu-scale $3 \
--deployment-runtime-class none \
--cluster-node-port-quantity 1000 \
--minimum-balance 100000