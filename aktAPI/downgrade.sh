#!/bin/bash
#$1 can be network...
#pwd="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
#export AKASH_VERSION=$(/bin/bash "$pwd/getAkashLatestVersion.sh")
export AKASH_VERSION="$1"

echo "downgrading akash binaries to $1" && \
cd "$HOME/.HandyHost/aktData" && \
curl https://raw.githubusercontent.com/ovrclk/akash/master/godownloader.sh | sh -s -- "$AKASH_VERSION" && \

echo "downgrading akash repo to $1" && \
./downgradeAkashRepo.sh "$1" && \
echo "downgrading akash CRD" && \
./downgradeCRD.sh "$1"