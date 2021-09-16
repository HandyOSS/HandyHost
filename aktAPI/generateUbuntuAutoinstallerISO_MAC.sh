#!/bin/bash
cd "$HOME/.HandyHost/aktData/ubuntu-autoinstall-generator" && \
./ubuntu-autoinstall-generator.sh -k -a -u user-data -d ./ubuntu-autoinstaller.iso && \
echo "and device path passed in: ${1}"