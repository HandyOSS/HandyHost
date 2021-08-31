#!/bin/bash
#install dvpn-node
if [[ ! -s "$HOME/.bash_profile" && -s "$HOME/.profile" ]] ; then
  profile_file="$HOME/.profile"
else
  profile_file="$HOME/.bash_profile"
fi
if [[ -s "$HOME/.zshrc" ]] ; then
	profile_file="$HOME/.zshrc"
fi

source $profile_file && \
mkdir -p ${HOME}/.HandyHost/sentinelData && \
#!/bin/bash
#install dvpn-node
if [[ -d ${HOME}/.HandyHost/sentinelData/dvpn-node ]] ; then
	echo "dvpn already exists, removing"
	rm -rf ${HOME}/.HandyHost/sentinelData/dvpn-node
fi

git clone https://github.com/sentinel-official/dvpn-node.git ${HOME}/.HandyHost/sentinelData/dvpn-node && \
cd ${HOME}/.HandyHost/sentinelData/dvpn-node && \
commit=$(git rev-list --tags --max-count=1) && \
git checkout $(git describe --tags ${commit}) && \
docker build --file Dockerfile \
--tag sentinel-dvpn-node \
--force-rm \
--no-cache \
--compress . && \
exit 0