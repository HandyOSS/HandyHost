#!/bin/bash
cd ~/.HandyHost/aktData && \
export KUBECONFIG=./admin.conf && \
POUT=$(kubectl describe node $1)
ALLOCATED=$(echo "${POUT}" | grep "Allocated resources:" -A 9) && \
ALLOCATABLE=$(echo "${POUT}" | grep "Allocatable:" -A 7) && \
CAPACITY=$(echo "${POUT}" | grep "Capacity:" -A 7) && \
printf "\n\n" && \
echo "${ALLOCATABLE}" && \
printf "\n\n" && \
echo "${ALLOCATED}" && \
printf "\n\n" && \
echo "${CAPACITY}"