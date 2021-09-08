#!/bin/bash
#$1 = keyring pw
#$2 = walletname
(echo "$1"; echo "$1") | $HOME/.HandyHost/aktData/bin/akash --keyring-backend file keys add "$2"