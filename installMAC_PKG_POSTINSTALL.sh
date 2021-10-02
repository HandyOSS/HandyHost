#!/bin/bash
#mac installer
USERNAME="$(stat -f '%Su' $HOME)"
USERGROUP="$(id -gn $USERNAME)"
USERHOME="$HOME"
echo "USER ${USERNAME}, GROUP ${USERGROUP}, HOME ${USERHOME}"

PYTHON="$(which python3)"

if [[ ! -s "$HOME/.bash_profile" && -s "$HOME/.profile" ]] ; then
  profile_file="$HOME/.profile"
else
  profile_file="$HOME/.bash_profile"
fi
if [[ -s "$HOME/.zshrc" ]] ; then
	profile_file="$HOME/.zshrc"
fi

source $profile_file
if [ $1 = "local" ] ; then 
	pwd="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
else
	pwd="/Applications/HandyHost/HandyHost" #set to applications dir
fi

echo "Installer PWD: $pwd"

if [[ -s "$USERHOME/.HandyHost/handyhost.pid" ]] ; then
	HANDYHOSTPID="$(cat $USERHOME/.HandyHost/handyhost.pid)"
	if ps -p $HANDYHOSTPID > /dev/null
	then
		echo "###### STOPPING EXISTING HANDYHOST ######" && \
		kill $HANDYHOSTPID
	fi
fi

if [[ "$(uname -m)" == "arm64" ]]
then
  homebrew_prefix_default=/opt/homebrew
else
  homebrew_prefix_default=/usr/local
fi

echo "########## Installing HandyHost Dependencies... ##########"

#NOTE: just have mac users install this themselves...
# xcode-select --install > /dev/null 2>&1
# if [ 0 == $? ]; then
#     sleep 1
#     osascript <<EOD
# tell application "System Events"
#     tell process "Install Command Line Developer Tools"
#         keystroke return
#         click button "Agree" of window "License Agreement"
#     end tell
# end tell
# EOD
# else
#     echo "Command Line Developer Tools are already installed!"
# fi

which -s brew
if [[ $? != 0 ]] ; then
    # Install Homebrew
    echo "******* HOMEBREW IS REQUIRED, EXITING ***********"
    exit 1;
    # BREWGROUP=$(ls -ld "/usr/local/bin" | awk '{print $4}')
    # git clone https://github.com/Homebrew/brew "$homebrew_prefix_default/Homebrew" && \
    # chown -R $USERNAME:$BREWGROUP "$homebrew_prefix_default/Homebrew" && \
    # ln -s "$homebrew_prefix_default/Homebrew/bin/brew" "$homebrew_prefix_default/bin"

    
else
	echo "Homebrew Already Installed. Skipping Install."
	if ! grep -q "$homebrew_prefix_default/bin" "${profile_file}" ; then
	  echo "###Editing ${profile_file} to add $homebrew_prefix_default/bin variables###"
	  echo "export PATH=$PATH:$homebrew_prefix_default/bin" >> "${profile_file}"
	  source $profile_file
	fi
	echo "Updating Homebrew..."
	su - $USERNAME -c "brew update"
fi

which -s python3
if [[ $? != 0 ]] ; then
	su - $USERNAME -c "brew install python@3.9" && \
	PYTHON="$(which python3)"
fi

if [[ ! -d "$homebrew_prefix_default/opt/nvm" ]] ; then
    # Install nvm
    echo "installing nvm" && \
    su - $USERNAME -c "brew install nvm" && \
    mkdir "$USERHOME/.nvm"
else
	echo "nvm was present"
fi
export NVM_DIR=$USERHOME/.nvm && \
[ -s "$homebrew_prefix_default/opt/nvm/nvm.sh" ] && \. "$homebrew_prefix_default/opt/nvm/nvm.sh" && \
[ -s "$homebrew_prefix_default/opt/nvm/etc/bash_completion.d/nvm" ] && \. "$homebrew_prefix_default/opt/nvm/etc/bash_completion.d/nvm" && \
echo "Configuring HandyHost in $pwd" && \
NPMVERSION="$(cat $pwd/.nvmrc)"
echo "NPM VERSION TO INSTALL ${NPMVERSION}" && \
echo "PYTHON VERSION IS ${PYTHON}" && \
cd $pwd && \
nvm install $NPMVERSION && \
nvm use && \
sudo chown -R "$USERNAME:$USERGROUP" $pwd && \
su - $USERNAME -c "[ -s \"$homebrew_prefix_default/opt/nvm/nvm.sh\" ] && \. \"$homebrew_prefix_default/opt/nvm/nvm.sh\" && cd $pwd && nvm install $NPMVERSION && nvm use && npm config set python $PYTHON && cd $pwd && npm install --build-from-source --python=$PYTHON" && \
sudo chown -R "$USERNAME:$USERGROUP" ./node_modules && \
sudo npm install -g bower && \
sudo npm install -g forever && \
BOWER=$(which bower) && \
echo "Bower: $BOWER" && \
su - $USERNAME -c "[ -s \"$homebrew_prefix_default/opt/nvm/nvm.sh\" ] && \. \"$homebrew_prefix_default/opt/nvm/nvm.sh\" && cd $pwd && nvm install $NPMVERSION && nvm use && cd $pwd/client && $BOWER install" && \
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
	su - $USERNAME -c "brew install go"
	# wget "https://golang.org/dl/go1.17.darwin-${arch_name}.pkg" && \
	# sudo rm -rf /usr/local/go && \
	# sudo tar -C /usr/local -xzf "go1.17.darwin-${arch_name}.pkg"
	# sudo chown -R "$USERNAME:$USERGROUP" /usr/local/go
else
	echo "golang already present"
fi

#export PATH=$PATH:/usr/local/go/bin && \

if [[ ! -d "$USERHOME/.HandyHost/siaRepo" ]] ; then

	mkdir -p $USERHOME/.HandyHost/siaRepo && \
	git clone https://github.com/SiaFoundation/siad $USERHOME/.HandyHost/siaRepo 
	sudo chown -R "$USERNAME:$USERGROUP" $USERHOME/.HandyHost/siaRepo
else
	cd $USERHOME/.HandyHost/siaRepo && \
	git fetch --all && \
	git pull
fi

cd $USERHOME/.HandyHost/siaRepo && make dependencies && make && \
if ! grep -q '${USERHOME}/go/bin' "${profile_file}" ; then
  echo "###Editing ${profile_file} to add go env variables###"
  echo "export PATH=$PATH:${USERHOME}/go/bin" >> "${profile_file}"
  source $profile_file
fi

#################################
########### DVPN ################
#################################

which -s docker
if [[ $? != 0 ]] ; then
	echo "****** DOCKER NOT FOUND, EXITING ********"
	exit 1;
	# echo "Installing Docker..."
	# su - $USERNAME -c "brew install --cask docker" && \
	# xattr -d -r com.apple.quarantine /Applications/Docker.app && \
	# sudo open -a /Applications/Docker.app
else
	echo "Docker Already Installed. Skipping."
	echo "Starting Docker, this may take a minute..."
	if (! docker stats --no-stream ); then
	  # On Mac OS this would be the terminal command to launch Docker
	  open --background /Applications/Docker.app
	fi
fi

while ! docker system info > /dev/null 2>&1; do sleep 1; done

mkdir -p ${HOME}/.HandyHost/sentinelData && \
if [[ ! -d ${HOME}/.HandyHost/sentinelData/dvpn-node ]] ; then
	echo "installing DVPN"
	git clone https://github.com/sentinel-official/dvpn-node.git ${HOME}/.HandyHost/sentinelData/dvpn-node && \
	cd ${HOME}/.HandyHost/sentinelData/dvpn-node && \
	commit=$(git rev-list --tags --max-count=1) && \
	git checkout $(git describe --tags ${commit}) && \
	sudo chown -R "$USERNAME:$USERGROUP" $HOME/.HandyHost/sentinelData && \
	docker build --file Dockerfile \
	--tag sentinel-dvpn-node \
	--force-rm \
	--no-cache \
	--compress .
else 
  echo "DVPN already installed, skipping"
fi

# if [[ -d ${HOME}/.HandyHost/sentinelData/dvpn-node ]] ; then
# 	echo "dvpn already exists, removing"
# 	rm -rf ${HOME}/.HandyHost/sentinelData/dvpn-node
# fi


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

LATEST_KUBESPRAY=$(jq -r 'map(select(.prerelease != true)) | first | .tag_name' <<< $(curl --silent "https://api.github.com/repos/kubernetes-sigs/kubespray/releases"))

mkdir -p "${HOME}/.HandyHost/aktData" && \
if [[ ! -d "${HOME}/.HandyHost/aktData/kubespray" ]] ; then
  mkdir -p "${HOME}/.HandyHost/aktData/kubespray" && \
  cd "${HOME}/.HandyHost/aktData/kubespray" && \
  git clone https://github.com/kubernetes-sigs/kubespray.git . && \
  git checkout "$LATEST_KUBESPRAY"
  virtualenv --python=python3 venv && \
  . venv/bin/activate && \
  pip3 install -r requirements.txt
else
	echo "kubespray already installed, check for updates" && \
  cd ${HOME}/.HandyHost/aktData/kubespray && \
  git fetch --all && \
  LOCAL_KUBESPRAY=$(git describe --tags)
  
  echo "LOCAL: ${LOCAL_KUBESPRAY}, REMOTE: ${LATEST_KUBESPRAY}"
  if [[ "$LOCAL_KUBESPRAY" == "$LATEST_KUBESPRAY" ]]; then
    echo "Kubespray is up to date"
  else
    echo "kubespray is out of date, updating" && \
    git fetch --all
    git checkout "$LATEST_KUBESPRAY"
    virtualenv --python=python3 venv && \
    . venv/bin/activate && \
    pip3 uninstall -y ansible && \
    pip3 install -r requirements.txt
  fi
fi

if [[ ! -d ${HOME}/.HandyHost/aktData/ubuntu-autoinstall-generator ]] ; then
  echo "installing ubuntu-autoinstall-generator"
  cd ${HOME}/.HandyHost/aktData && \
  git clone https://github.com/HandyOSS/ubuntu-autoinstall-generator.git && \
  cd ubuntu-autoinstall-generator && \
  chmod +x ubuntu-autoinstall-generator.sh
else
  echo "check for ubuntu-autoinstall-generator updates"
  cd ${HOME}/.HandyHost/aktData/ubuntu-autoinstall-generator && \
  git fetch && \
  LOCAL=$(git rev-parse @)
  REMOTE=$(git rev-parse @{u})
  BASE=$(git merge-base @ @{u})

  if [[ "$LOCAL" == "$REMOTE" ]]; then
    echo "ubuntu-autoinstall-generator is up to date"
  else
    echo "ubuntu-autoinstall-generator is out of date, updating" && \
    git pull origin master
    chmod +x ubuntu-autoinstall-generator.sh
  fi
  
fi

cd $HOME/.HandyHost/aktData && \

su - $USERNAME -c "brew install cdrtools" && \
su - $USERNAME -c "brew install p7zip" && \
su - $USERNAME -c "brew install whois" && \
su - $USERNAME -c "brew install coreutils" && \
su - $USERNAME -c "brew install gnupg" && \
su - $USERNAME -c "brew install openssl@1.1" && \
su - $USERNAME -c "brew install jq" && \
echo "Finished Installing Akash Dependencies" && \

export AKASH_NET="https://raw.githubusercontent.com/ovrclk/net/master/mainnet"
export AKASH_VERSION=$(/bin/bash "$pwd/aktAPI/getAkashLatestVersion.sh")
export AKASH_CHAIN_ID="$(curl -s "$AKASH_NET/chain-id.txt")"
export AKASH_NODE="$(curl -s "$AKASH_NET/rpc-nodes.txt" | gshuf -n 1)"

if [[ ! -d "${USERHOME}/.HandyHost/aktData/akashRepo" ]] ; then
  mkdir -p "${USERHOME}/.HandyHost/aktData/akashRepo" && \
  cd "${USERHOME}/.HandyHost/aktData/akashRepo" && \
  git clone https://github.com/ovrclk/akash.git . && \
  git checkout "$AKASH_VERSION"
else
  cd "${USERHOME}/.HandyHost/aktData/akashRepo" && \
  git checkout "$AKASH_VERSION"
fi

chown -R "$USERNAME:$USERGROUP" "${USERHOME}/.HandyHost/aktData/akashRepo" && \

echo "installing akash software..." && \
cd $HOME/.HandyHost/aktData && \
curl https://raw.githubusercontent.com/ovrclk/akash/master/godownloader.sh | sh -s -- "$AKASH_VERSION" && \
sudo chown -R "$USERNAME:$USERGROUP" $pwd/aktAPI && \
sudo chown -R "$USERNAME:$USERGROUP" $HOME/.HandyHost/aktData

if [ ! $1 = "local" ] ; then 
	echo "Building HandyHost.app" && \
	cd "/Applications/HandyHost" && \
	which -s platypus
	if [[ $? != 0 ]] ; then
		echo "Installing Platypus"
		su - $USERNAME -c "brew install --cask platypus" && \
		xattr -d -r com.apple.quarantine /Applications/Platypus.app && \
		su - $USERNAME -c "brew install platypus" && \
		su - $USERNAME -c "brew link platypus"
	else
		echo "Platypus Installed. Skipping."
	fi
	if [[ -d "/Applications/HandyHost/HandyHost.app" ]] ; then
		echo "removing old HandyHost App Build" && \
		rm -rf "/Applications/HandyHost/HandyHost.app"
	fi

	platypus -P /Applications/HandyHost/HandyHost/MacOS_Resources/HandyHost.platypus HandyHost.app && \
	cp "$pwd/MacOS_Resources/handyhost.startup.plist" "$USERHOME/Library/LaunchAgents/handyhost.startup.plist" && \
	chown "$USERNAME:$USERGROUP" "$USERHOME/Library/LaunchAgents/handyhost.startup.plist" && \
	su - $USERNAME -c "launchctl unload -w \"$USERHOME/Library/LaunchAgents/handyhost.startup.plist\""; \
	sleep 1 && \
	su - $USERNAME -c "launchctl load -w \"$USERHOME/Library/LaunchAgents/handyhost.startup.plist\"" && \
	echo "Done Compiling HandyHost.app" && \
	sleep 10 && \
	su - $USERNAME -c "open /Applications/HandyHost/HandyHost.app"
else
	echo "Finished setting up local build"
fi
node $pwd/rainbow.js && \
exit 0
