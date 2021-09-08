#!/bin/bash
P10=""
if [ "${10}" ]
	then
	P10="--timeout-height ${10}"
fi

(echo "$1";) | $HOME/.HandyHost/aktData/bin/akash tx market bid create \
--deposit $2 \
--price $3 \
--dseq $4 \
--gseq $5 \
--oseq $6 \
--fees $7 \
--gas auto \
--keyring-backend file \
--from $8 \
--node $AKASH_NODE \
--owner $9 $P10 \
-y
