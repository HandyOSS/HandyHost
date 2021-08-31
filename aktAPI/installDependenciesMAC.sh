#!/bin/bash
#install deps
echo "installing akash dependencies..." && \
#sudo apt install unzip && \
#brew install openssl && \
#brew install avahi && \
#sudo apt install -y avahi-utils && \
brew install virtualenv && \
#sudo apt install -y expect && \
# sudo curl -fsSLo /usr/share/keyrings/kubernetes-archive-keyring.gpg https://packages.cloud.google.com/apt/doc/apt-key.gpg && \
# echo "deb [signed-by=/usr/share/keyrings/kubernetes-archive-keyring.gpg] https://apt.kubernetes.io/ kubernetes-xenial main" | sudo tee /etc/apt/sources.list.d/kubernetes.list && \
# sudo apt-get update && \
# sudo apt-get install -y kubectl && \
which -s kubectl
if [[ $? != 0 ]] ; then
	echo "Installing Kubectl..."
	brew install kubectl
else
	echo "kubectl Already Installed. Skipping."
fi
if [[ ! -d ${HOME}/.HandyHost/aktData/kubespray ]] ; then
	echo "installing kubespray"
	mkdir -p ~/.HandyHost/aktData/kubespray && \
	cd ~/.HandyHost/aktData/kubespray && \
	git clone https://github.com/kubernetes-sigs/kubespray.git .
else
	echo "kubespray exists, check up to date."
	cd ~/.HandyHost/aktData/kubespray && \
	git fetch --all && \
	git pull
fi

virtualenv --python=python3 venv && \
. venv/bin/activate && \
pip3 install -r requirements.txt && \
cd ~/.HandyHost/aktData && \
if [[ ! -d ${HOME}/.HandyHost/aktData/ubuntu-autoinstall-generator ]] ; then
	echo "installing ubuntu-autoinstall-generator"
	git clone https://github.com/covertsh/ubuntu-autoinstall-generator.git && \
	cd ubuntu-autoinstall-generator && \
	chmod +x ubuntu-autoinstall-generator.sh
else
	echo "updating ubuntu-autoinstall-generator"
	cd ubuntu-autoinstall-generator && \
	git fetch --all && \
	git pull && 
	chmod +x ubuntu-autoinstall-generator.sh
fi

#sudo apt install -y genisoimage && \
brew install cdrtools && \
brew install p7zip && \
brew install whois && \
echo "Finished Installing Akash Dependencies" && \
exit 0