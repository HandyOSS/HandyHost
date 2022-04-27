#!/bin/bash
USERHOME="$HOME"
if [[ "$OSTYPE" == "darwin"* ]] ; then
  USERNAME="$(stat -f '%Su' $USERHOME)"
else
  USERNAME="$(ls -ld $HOME | awk '{print $3}')"
fi
USERGROUP="$(id -gn $USERNAME)"

#pwd="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

#AKASH_VERSION=$(/bin/bash "$pwd/getAkashLatestVersion.sh")

AKASH_VERSION=$1

cd ${USERHOME}/.HandyHost/aktData && \
if [[ ! -d "${USERHOME}/.HandyHost/aktData/akashRepo" ]] ; then
  mkdir -p "${USERHOME}/.HandyHost/aktData/akashRepo" && \
  cd "${USERHOME}/.HandyHost/aktData/akashRepo" && \
  git clone https://github.com/ovrclk/akash.git . && \
  git checkout "$AKASH_VERSION"
else
  cd "${USERHOME}/.HandyHost/aktData/akashRepo" && \
  git fetch --all && \
  git checkout "$AKASH_VERSION"
fi

chown -R "$USERNAME:$USERGROUP" "${USERHOME}/.HandyHost/aktData/akashRepo"