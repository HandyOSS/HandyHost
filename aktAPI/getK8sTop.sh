#!/bin/bash
cd ~/.HandyHost/aktData && \
export KUBECONFIG=./admin.conf && \
kubectl top nodes --use-protocol-buffers