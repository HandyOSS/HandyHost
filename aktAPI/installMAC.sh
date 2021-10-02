#!/bin/bash
#$1 can be network...
pwd="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
export AKASH_VERSION="$(/bin/bash "$pwd/getAkashLatestVersion.sh")"

echo "installing akash software..." && \
cd "$HOME/.HandyHost/aktData" && \
curl https://raw.githubusercontent.com/ovrclk/akash/master/godownloader.sh | sh -s -- "$AKASH_VERSION" && \
exit 0