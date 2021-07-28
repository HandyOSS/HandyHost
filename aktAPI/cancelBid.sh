#!/bin/bash

(echo "$1";) | ./bin/akash tx market bid close \
--dseq $2 \
--gseq $3 \
--oseq $4 \
--fees $5 \
--gas auto \
--keyring-backend file \
--from $6 \
--node $AKASH_NODE \
--owner $7 \
--provider $8 \
-y
