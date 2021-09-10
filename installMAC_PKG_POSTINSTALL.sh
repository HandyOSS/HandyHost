#!/bin/bash
#mac installer
USERNAME="$(stat -f '%Su' $HOME)"
USERGROUP="$(id -gn $USERNAME)"

echo "USER ${USERNAME}, GROUP ${USERGROUP}"

if [[ ! -s "$HOME/.bash_profile" && -s "$HOME/.profile" ]] ; then
  profile_file="$HOME/.profile"
else
  profile_file="$HOME/.bash_profile"
fi
if [[ -s "$HOME/.zshrc" ]] ; then
	profile_file="$HOME/.zshrc"
fi

source $profile_file

pwd="/Applications/HandyHost/HandyHost" #set to applications dir

echo "PWD: ${PWD}"
echo "########## Installing HandyHost Dependencies... ##########"
which -s brew
if [[ $? != 0 ]] ; then
    # Install Homebrew
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if ! grep -q 'usr/local/bin' "${profile_file}" ; then
	  echo "###Editing ${profile_file} to add /usr/local/bin variables###"
	  echo "export PATH=$PATH:/usr/local/bin" >> "${profile_file}"
	  source $profile_file
	fi
else
	echo "Homebrew Already Installed. Skipping Install."
	echo "Updating Homebrew..."
	su - $USERNAME -c "brew update"
fi

which -s node
if [[ $? != 0 ]] ; then
	echo "Installing Node.js"
	su - $USERNAME -c "brew install node"
else
	echo "nodejs Installed. Skipping."
fi
cd $pwd && \
npm install --build-from-source --python=/usr/bin/python3 && \
sudo npm install -g bower && \
su - $USERNAME && \
cd $pwd/client && \
bower install && \
mkdir -p $HOME/.HandyHost && \
sudo chown -R "$USERNAME:$USERGROUP" $HOME/.HandyHost && \

################################
########### SIA ################
################################

architecture=$(uname -m)
arch_name="amd64"
if [ "${architecture}" = "arm64" ]; then
    arch_name="arm64"
fi

which -s go
if [[ $? != 0 ]] ; then
	echo "installing golang"
	wget "https://golang.org/dl/go1.17.darwin-${arch_name}.pkg" && \
	sudo rm -rf /usr/local/go && \
	sudo tar -C /usr/local -xzf "go1.17.darwin-${arch_name}.pkg"
	sudo chown -R "$USERNAME:$USERGROUP" /usr/local/go
fi

export PATH=$PATH:/usr/local/go/bin && \

if [[ ! -s "$HOME/.HandyHost/siaRepo" ]] ; then

	mkdir -p $HOME/.HandyHost/siaRepo && \
	git clone https://github.com/SiaFoundation/siad $HOME/.HandyHost/siaRepo 
	sudo chown -R "$USERNAME:$USERGROUP" $HOME/.HandyHost/siaRepo
else
	cd $HOME/.HandyHost/siaRepo && \
	git fetch --all && \
	git pull
fi

cd $HOME/.HandyHost/siaRepo && make dependencies && make && \
if ! grep -q 'usr/local/go/bin' "${profile_file}" ; then
  echo "###Editing ${profile_file} to add go env variables###"
  echo "export PATH=$PATH:/usr/local/go/bin:${HOME}/go/bin" >> "${profile_file}"
  source $profile_file
fi

#################################
########### DVPN ################
#################################

which -s docker
if [[ $? != 0 ]] ; then
	echo "Installing Docker..."
	brew cask install docker
else
	echo "Docker Already Installed. Skipping."
	echo "Starting Docker, this may take a minute..."
	open --background -a Docker &&
  	while ! docker system info > /dev/null 2>&1; do sleep 1; done
fi

mkdir -p ${HOME}/.HandyHost/sentinelData && \

if [[ -d ${HOME}/.HandyHost/sentinelData/dvpn-node ]] ; then
	echo "dvpn already exists, removing"
	rm -rf ${HOME}/.HandyHost/sentinelData/dvpn-node
fi

git clone https://github.com/sentinel-official/dvpn-node.git ${HOME}/.HandyHost/sentinelData/dvpn-node && \
cd ${HOME}/.HandyHost/sentinelData/dvpn-node && \
commit=$(git rev-list --tags --max-count=1) && \
git checkout $(git describe --tags ${commit}) && \
sudo chown -R "$USERNAME:$USERGROUP" $HOME/.HandyHost/sentinelData && \
docker build --file Dockerfile \
--tag sentinel-dvpn-node \
--force-rm \
--no-cache \
--compress . && \

################################
########### AKT ################
################################

echo "installing akash dependencies..." && \

su - $USERNAME -c "brew install virtualenv" && \

which -s kubectl
if [[ $? != 0 ]] ; then
	echo "Installing Kubectl..."
	su - $USERNAME -c "brew install kubectl"
else
	echo "kubectl Already Installed. Skipping."
fi
if [[ ! -d ${HOME}/.HandyHost/aktData/kubespray ]] ; then
	echo "installing kubespray"
	mkdir -p ~/.HandyHost/aktData/kubespray && \
	cd $HOME/.HandyHost/aktData/kubespray && \
	git clone https://github.com/kubernetes-sigs/kubespray.git .
else
	echo "kubespray exists, check up to date."
	cd $HOME/.HandyHost/aktData/kubespray && \
	git fetch --all && \
	git pull
fi

sudo chown -R "$USERNAME:$USERGROUP" $HOME/.HandyHost/aktData && \

virtualenv --python=python3 venv && \
. venv/bin/activate && \
pip3 install -r requirements.txt && \
cd $HOME/.HandyHost/aktData && \
if [[ ! -d ${HOME}/.HandyHost/aktData/ubuntu-autoinstall-generator ]] ; then
	echo "installing ubuntu-autoinstall-generator"
	git clone https://github.com/covertsh/ubuntu-autoinstall-generator.git && \
	cd ubuntu-autoinstall-generator && \
	chmod +x ubuntu-autoinstall-generator.sh && \
	sudo chown -R "$USERNAME:$USERGROUP" $HOME/.HandyHost/aktData/ubuntu-autoinstall-generator
else
	echo "updating ubuntu-autoinstall-generator"
	cd ubuntu-autoinstall-generator && \
	git fetch --all && \
	git pull && 
	chmod +x ubuntu-autoinstall-generator.sh
fi

su - $USERNAME -c "brew install cdrtools" && \
su - $USERNAME -c "brew install p7zip" && \
su - $USERNAME -c "brew install whois" && \
echo "Finished Installing Akash Dependencies" && \

export AKASH_NET="https://raw.githubusercontent.com/ovrclk/net/master/mainnet"
export AKASH_VERSION="$(curl -s "$AKASH_NET/version.txt")"
export AKASH_CHAIN_ID="$(curl -s "$AKASH_NET/chain-id.txt")"
export AKASH_NODE="$(curl -s "$AKASH_NET/rpc-nodes.txt" | shuf -n 1)"

echo "installing akash software..." && \
cd $HOME/.HandyHost/aktData && \
curl https://raw.githubusercontent.com/ovrclk/akash/master/godownloader.sh | sh -s -- "v$AKASH_VERSION" && \
sudo chown -R "$USERNAME:$USERGROUP" $pwd/aktAPI && \
sudo chown -R "$USERNAME:$USERGROUP" $HOME/.HandyHost/aktData && \

echo "Building HandyHost.app" && \
cd "/Applications/HandyHost" && \
which -s platypus
if [[ $? != 0 ]] ; then
	echo "Installing Platypus"
	su - $USERNAME -c "brew install --cask platypus"
else
	echo "Platypus Installed. Skipping."
fi
platypus -P /Applications/HandyHost/HandyHost/MacOS_Resources/HandyHost.platypus HandyHost.app && \
echo "Done Compiling HandyHost.app" && \


node $pwd/rainbow.js && \
exit 0
