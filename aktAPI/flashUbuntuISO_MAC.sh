#!/bin/bash
echo "Starting USB ISO Writing..." && \
diskutil unmountDisk $1 && \
(echo "$3";) | sudo -S dd bs=$2 if=$HOME/.HandyHost/aktData/ubuntu-autoinstall-generator/ubuntu-autoinstaller.iso of=$1 conv=sync