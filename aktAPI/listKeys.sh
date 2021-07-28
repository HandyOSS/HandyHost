#!/bin/bash
#$1 = pw
(echo "$1"; echo "$1") | ./bin/akash keys list --keyring-backend file