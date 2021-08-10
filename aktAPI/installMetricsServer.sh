#!/bin/bash
export KUBECONFIG=$HOME/.HandyHost/aktData/admin.conf && \
cd $HOME/.HandyHost/aktData/akash_cluster_resources && \
kubectl apply -f metrics-server-handyhost.yaml --overwrite