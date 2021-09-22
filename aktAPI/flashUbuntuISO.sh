#!/bin/bash
echo "Starting USB ISO Writing..." && \
dd bs=$2 if="$HOME/.HandyHost/aktData/ubuntu-autoinstall-generator/ubuntu-autoinstaller.iso" of=$1 conv=fdatasync status=progress