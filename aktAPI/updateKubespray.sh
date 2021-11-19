#!/bin/bash
USERHOME="$HOME"

if [[ "$OSTYPE" == "darwin"* ]] ; then
  USERNAME="$(stat -f '%Su' $USERHOME)"
else
  USERNAME="$(ls -ld $HOME | awk '{print $3}')"
fi
USERGROUP="$(id -gn $USERNAME)"

pwd="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
DIDUPDATE=0

VERSIONFILE="$HOME/.HandyHost/aktData/latestKubesprayVersion"
if [[ ! -s "$VERSIONFILE" ]] ; then
  VERSION=$(jq -r 'map(select(.prerelease != true)) | first | .tag_name' <<< $(curl --silent "https://api.github.com/repos/kubernetes-sigs/kubespray/releases"))
else
  VERSION=$(cat "$VERSIONFILE")
fi

LATEST_KUBESPRAY="$VERSION"

if [[ "$OSTYPE" == "darwin"* ]]; then
  arch_name="$(uname -m)"
   
  if [ "${arch_name}" = "x86_64" ]; then
      which -s sysctl
      if [[ $? != 0 ]] ; then
          homebrew_prefix_default=/usr/local
      else 
        if [ "$(sysctl -in sysctl.proc_translated)" = "1" ]; then
            homebrew_prefix_default=/opt/homebrew
        else
            homebrew_prefix_default=/usr/local
        fi 
      fi
  fi
  if [ "${arch_name}" = "arm64" ]; then
    homebrew_prefix_default=/opt/homebrew
  fi
fi

##for whatever reason, on macOS, kubespray fails with python3.10, force it to use 3.9...
if [[ "$OSTYPE" == "darwin"* ]]; then
  LOCALPYTHON="$homebrew_prefix_default/opt/python@3.9/bin/python3.9"
else
  LOCALPYTHON=python3
fi

if [[ ! -d "${USERHOME}/.HandyHost/aktData/kubespray" ]] ; then
  mkdir -p "${USERHOME}/.HandyHost/aktData/kubespray" && \
  cd "${USERHOME}/.HandyHost/aktData/kubespray" && \
  git clone https://github.com/kubernetes-sigs/kubespray.git . && \
  git checkout "$LATEST_KUBESPRAY"
  virtualenv --python="$LOCALPYTHON" venv
  . venv/bin/activate
  pip3 install -r requirements.txt
else
  echo "kubespray already installed, check for updates" && \
  cd "${USERHOME}/.HandyHost/aktData/kubespray" && \
  git fetch --all
  LOCAL_KUBESPRAY=$(git describe --tags )
  if [[ "$LOCAL_KUBESPRAY" == "$LATEST_KUBESPRAY" ]]; then
    echo "Kubespray is up to date"
  else
    echo "kubespray is out of date, updating" && \
    git fetch --all
    git checkout "$LATEST_KUBESPRAY"
    virtualenv --python="$LOCALPYTHON" venv
    . venv/bin/activate
    pip3 uninstall -y ansible
    pip3 install -r requirements.txt
    DIDUPDATE=1
  fi
fi
echo "kubespray update is done, checking akash for kubernetes updates."
#update k8s cluster whenever this script is ran
#it could either be called because kubespray needed updates
#alternately akash released a new version

/bin/bash "$pwd/updateAkashRepo.sh"

echo "done checking out kubespray and akash repos"
