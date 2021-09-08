#!/bin/bash
#$1 = mnemonic
#$2 = pw
#$3 = walletname
(echo "$1"; echo "$2"; echo "$2") | $HOME/.HandyHost/aktData/bin/akash --keyring-backend file keys add $3 --recover