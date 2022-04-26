#!/usr/bin/env bash

kubectl get mani -n lease -o 'custom-columns=name:{.metadata.name}' --no-headers | \
 while read ns; do

   # if ns exists, it's a fresh manifest.
   if kubectl get ns "$ns" >/dev/null 2>&1; then
     echo "FOUND: $ns"
     continue
   fi

   # make sure it's a NotFound error before deleting.
   nserr=$(kubectl get ns "$ns" 2>&1)
   if [[ "$nserr" == *NotFound* ]]; then
     echo "GONE: $ns"
     kubectl delete mani "$ns" -n lease
     continue
   fi
 done