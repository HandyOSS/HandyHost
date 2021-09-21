#!/bin/bash
echo "Starting USB ISO Writing..." && \
sudo dd bs=$2 if="$HOME/.HandyHost/aktData/ubuntu-autoinstall-generator/ubuntu-autoinstaller.iso" of=$1 conv=fdatasync status=progress