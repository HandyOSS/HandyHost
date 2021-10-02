#!/bin/bash
pwd="$PWD"

#USERNAME="$SUDO_USER" ###if you want to run the application as your user, uncomment this
USERNAME="$USER" ###if you want to run everything as root, uncomment this

USERHOME="$(eval echo ~$USERNAME)"
USERGROUP="$(id -gn $USERNAME)"

echo "USERHOME pre validation $USERHOME"
if [ $USERHOME = "/root" ] ; then
  echo "USERHOME IS ROOT"
  echo "RUNNING AS $USER"
  #deb file can be run thru double click
  #in which case the app is installed as root
  USER="root"
  USERNAME="$USER"
  USERHOME="$(eval echo ~$USER)"
  USERGROUP="$(id -gn $USERNAME)"
  HOME="$USERHOME"
else
  echo "USERHOME ISSET $USERHOME"
fi

architecture=$(dpkg --print-architecture)

sudo chown -R "$USERNAME:$USERGROUP" $pwd && \
if [[ ! -s "$USERHOME/.bash_profile" && -s "$USERHOME/.profile" ]] ; then
  profile_file="$USERHOME/.profile"
else
  profile_file="$USERHOME/.bash_profile"
fi
source $profile_file && \
echo -e "RUNNING USER IS: $USER" && \
echo -e "USERHOME: $USERHOME" && \
echo -e "USERNAME: $USERNAME" && \
##install nvm

source $USERHOME/.bashrc && \
if [[ ! -d "$USERHOME/.nvm" ]] ; then
    # Install nvm
    if [ $USERNAME = "root" ] ; then
      cd $USERHOME && \
      git clone https://github.com/nvm-sh/nvm.git $USERHOME/.nvm && 
      cd $USERHOME/.nvm && \
      git checkout v0.38.0
      #curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
    else
      su - $USERNAME -c "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash"
    fi
fi
echo "NVM installation complete" && \
export NVM_DIR="$USERHOME/.nvm" && \
NVM_DIR="$USERHOME/.nvm" && \
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && \
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" && \
echo "INSTALL NVM VERSION $(cat $pwd/.nvmrc)" && \
cd $pwd && nvm install $(cat $pwd/.nvmrc)

echo -e "########## \x1b[92mInstalling HandyHost Dependencies...\x1b[0m ##########" && \

mkdir -p $USERHOME/.HandyHost

if [[ ! -d "$HOME/.handy" ]] ; then
  mkdir "$HOME/.handy" && \
  openssl genrsa -out "$HOME/.handy/handyhost.key" 4096 && \
  openssl rsa -in "$HOME/.handy/handyhost.key" -pubout -out "$HOME/.handy/handyhost.pub" && \
  chmod -R 0600 "$HOME/.handy" && \
  chmod 0644 "$HOME/.handy/handyhost.pub"
fi


if [[ ! -d "$USERHOME/.HandyHost/keystore" ]] ; then
  mkdir "$USERHOME/.HandyHost/keystore" && \
  chmod 0700 "$USERHOME/.HandyHost/keystore" && \
  openssl genrsa -out "$USERHOME/.HandyHost/keystore/handyhost.key" 4096 && \
  openssl rsa -in "$USERHOME/.HandyHost/keystore/handyhost.key" -pubout -out "$USERHOME/.HandyHost/keystore/handyhost.pub" && \
  chmod 0644 "$USERHOME/.HandyHost/keystore/handyhost.pub" && \
  chmod 0600 "$USERHOME/.HandyHost/keystore/handyhost.key" && \
  cp "$HOME/.handy/handyhost.pub" "$USERHOME/.HandyHost/keystore/daemon.pub" && \
  chown "$USERNAME:$USERGROUP" "$USERHOME/.HandyHost/keystore/daemon.pub" && \
  chmod 0644 "$USERHOME/.HandyHost/keystore/daemon.pub"
fi

cd $pwd
if [ $USERNAME = "root" ] ; then
  VER=$(cat $pwd/.nvmrc)
  echo "VERSION TARGET: $VER" && \
  cd $pwd && nvm install "$VER" && \
  source $USERHOME/.bashrc && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" && cd $pwd && nvm install "$VER" && nvm use && npm config set user 0 && npm config set unsafe-perm true && npm install --build-from-source --python=/usr/bin/python3

else
  su - $USERNAME -c "source $USERHOME/.bashrc && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" && cd $pwd && nvm install $(cat $pwd/.nvmrc) && nvm use && npm install --build-from-source --python=/usr/bin/python3"

fi

VER=$(cat $pwd/.nvmrc)
echo "VERSION TARGET: $VER" && \
nvm install "$VER" && \

nvm use && \
npm install -g bower && \
npm install -g forever && \
cd $pwd/client
if [ $USERNAME = "root" ] ; then
  cd $pwd && source $USERHOME/.bashrc && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" && cd $pwd && nvm install $(cat $pwd/.nvmrc) && nvm use && cd $pwd/client && bower install --allow-root

else
  su - $USERNAME -c "cd $pwd && source $USERHOME/.bashrc && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" && cd $pwd && nvm install $(cat $pwd/.nvmrc) && nvm use && cd $pwd/client && bower install"
fi

sudo chown -R "$USERNAME:$USERGROUP" $USERHOME/.HandyHost && \

echo -e "########## \x1b[92mInstalling Sia\x1b[0m ##########" && \


cd $USERHOME/.HandyHost && \
if [[ ! -s "/usr/local/go" ]] ; then
  echo "Installing Go"
  wget "https://golang.org/dl/go1.16.6.linux-${architecture}.tar.gz" && \
  sudo rm -rf /usr/local/go && \
  sudo tar -C /usr/local -xzf "go1.16.6.linux-${architecture}.tar.gz" && \
  sudo rm "go1.16.6.linux-${architecture}.tar.gz"
else
  echo "Go already installed"
fi
export PATH=$PATH:/usr/local/go/bin && \
if [[ ! -d "$USERHOME/.HandyHost/siaRepo" ]] ; then

 	mkdir -p $USERHOME/.HandyHost/siaRepo && \
	git clone https://github.com/SiaFoundation/siad $USERHOME/.HandyHost/siaRepo 
else
	cd $USERHOME/.HandyHost/siaRepo && \
	git fetch --all && \
	git pull
fi

#export GOPATH="$USERHOME/go"
if [ $USERNAME = "root" ] ; then
  export PATH=$PATH:/usr/local/go/bin:${USERHOME}/go/bin
  source $profile_file && \
  export HOME="$USERHOME" && \
  cd $USERHOME/.HandyHost/siaRepo && make dependencies && make
else
  su - $USERNAME -c "cd $USERHOME/.HandyHost/siaRepo && make dependencies && make"
fi

if ! grep -q "${USERHOME}/go/bin" "${profile_file}" ; then
  echo "###Editing ${profile_file} to add go env variables###"
  echo "export PATH=$PATH:/usr/local/go/bin:${USERHOME}/go/bin" >> "${profile_file}"
  source $profile_file
fi
# if ! grep -q "export GOPATH" "${profile_file}" ; then
#   echo "export GOPATH=$USERHOME/go" >> "${profile_file}"
#   source $profile_file
# fi

echo -e "########## \x1b[92mInstalling DVPN\x1b[0m ##########" && \

cd $pwd/dvpnAPI && \
# if ! command -v docker &> /dev/null 
# then
#     # Install Docker
#     curl -fsSL get.docker.com -o ${USERHOME}/get-docker.sh && \
#     sudo sh ${USERHOME}/get-docker.sh
# fi
export HOME=$USERHOME
echo "Setting up Docker nosudo" && \
sudo groupadd docker || true && \
sudo gpasswd -a $USERNAME docker || true && \

sudo machinectl shell --uid=$USERNAME .host $(which dockerd-rootless-setuptool.sh) install --force | echo "$(grep 'export DOCKER_HOST')" >> ${profile_file} && \
if ! grep -q 'PATH=/usr/bin' "${profile_file}" ; then
  echo "export PATH=/usr/bin:$PATH" >> "${profile_file}"
fi
sudo machinectl shell --uid=$USERNAME .host $(which systemctl) --user enable docker && \
sudo machinectl shell --uid=$USERNAME .host $(which loginctl) enable-linger $USERNAME

source ${USERHOME}/.profile && \
echo "DOCKER HOST: ${DOCKER_HOST}" && \
mkdir -p ${USERHOME}/.HandyHost/sentinelData && \
if [[ ! -d ${USERHOME}/.HandyHost/sentinelData/dvpn-node ]] ; then
	echo "installing DVPN"
	git clone https://github.com/sentinel-official/dvpn-node.git ${USERHOME}/.HandyHost/sentinelData/dvpn-node && \
  cd ${USERHOME}/.HandyHost/sentinelData/dvpn-node && \
  commit=$(git rev-list --tags --max-count=1) && \
  git checkout $(git describe --tags ${commit}) && \
  sudo chown -R "$USERNAME:$USERGROUP" $USERHOME/.HandyHost/sentinelData && \
  sudo machinectl shell --uid=$USERNAME --setenv="DOCKER_HOST=${DOCKER_HOST}" .host $(which docker) build --file ${USERHOME}/.HandyHost/sentinelData/dvpn-node/Dockerfile \
  --tag sentinel-dvpn-node \
  --force-rm \
  --no-cache \
  --compress ${USERHOME}/.HandyHost/sentinelData/dvpn-node/
else 
  echo "DVPN already installed, skipping"
fi


echo -e "########## \x1b[92mInstalling Akash\x1b[0m ##########" && \

LATEST_KUBESPRAY=$(jq -r 'map(select(.prerelease != true)) | first | .tag_name' <<< $(curl --silent "https://api.github.com/repos/kubernetes-sigs/kubespray/releases"))

cd $pwd/aktAPI && \
if [[ ! -d ${USERHOME}/.HandyHost/aktData/kubespray ]] ; then
  mkdir -p ${USERHOME}/.HandyHost/aktData/kubespray && \
  cd ${USERHOME}/.HandyHost/aktData/kubespray && \
  git clone https://github.com/kubernetes-sigs/kubespray.git . && \
  git checkout "$LATEST_KUBESPRAY" && \
  virtualenv --python=python3 venv && \
  . venv/bin/activate && \
  pip3 install -r requirements.txt
else
  echo "kubespray already installed, check for updates" && \
  cd ${USERHOME}/.HandyHost/aktData/kubespray && \
  git fetch --all && \
  LOCAL_KUBESPRAY=$(git describe --tags)

  if [[ "$LOCAL_KUBESPRAY" == "$LATEST_KUBESPRAY" ]]; then
    echo "Kubespray is up to date"
  else
    echo "kubespray is out of date, updating" && \
    git fetch --all && \
    git checkout "$LATEST_KUBESPRAY" && \
    virtualenv --python=python3 venv && \
    . venv/bin/activate && \
    pip3 uninstall -y ansible && \
    pip3 install -r requirements.txt
  fi
fi

if [[ ! -d ${USERHOME}/.HandyHost/aktData/ubuntu-autoinstall-generator ]] ; then
  echo "installing ubuntu-autoinstall-generator"
  cd ${USERHOME}/.HandyHost/aktData && \
  git clone https://github.com/covertsh/ubuntu-autoinstall-generator.git && \
  cd ubuntu-autoinstall-generator && \
  chmod +x ubuntu-autoinstall-generator.sh
else
  echo "check for ubuntu-autoinstall-generator updates"
  cd ${USERHOME}/.HandyHost/aktData/ubuntu-autoinstall-generator && \
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

export AKASH_NET="https://raw.githubusercontent.com/ovrclk/net/master/mainnet"
export AKASH_VERSION=$(/bin/bash "$pwd/aktAPI/getAkashLatestVersion.sh")
export AKASH_CHAIN_ID="$(curl -s "$AKASH_NET/chain-id.txt")"
export AKASH_NODE="$(curl -s "$AKASH_NET/rpc-nodes.txt" | shuf -n 1)"

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

chown -R "$USERNAME:$USERGROUP" "${USERHOME}/.HandyHost/aktData/akashRepo" && \

echo "installing Akash software..." && \
curl https://raw.githubusercontent.com/ovrclk/akash/master/godownloader.sh | sh -s -- "$AKASH_VERSION"

echo -e "########## \x1b[92mDONE INSTALLING!\x1b[0m ##########" && \
cd $pwd && \
nvm use && \
sudo chown -R "$USERNAME:$USERGROUP" $USERHOME/go && \
sudo chown -R "$USERNAME:$USERGROUP" $pwd && \
sudo chown -R "$USERNAME:$USERGROUP" $USERHOME/.HandyHost && \

node rainbow.js && \
echo "HandyHost is installed and ready to run!" && \
echo -e "Run manually with: \x1b[92m sudo ./localdev_bootstrap.sh\x1b[0m" && \
echo -e "Or restart with: \x1b[92m sudo ./localdev_bootstrap.sh restart\x1b[0m" && \
echo -e "\x1b[92mHandyHost will be available on: http://localhost:8008\x1b[0m" && \
echo -e "\x1b[92mHandyHost will aos be available on: https://localhost:58008\x1b[0m (self-signed certificate, generated by you)"