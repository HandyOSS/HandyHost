#!/bin/bash
#install deps
echo "installing akash dependencies..." && \
sudo apt install -y avahi-utils && \
sudo apt install -y virtualenv && \
sudo apt install -y expect && \
sudo curl -fsSLo /usr/share/keyrings/kubernetes-archive-keyring.gpg https://packages.cloud.google.com/apt/doc/apt-key.gpg && \
echo "deb [signed-by=/usr/share/keyrings/kubernetes-archive-keyring.gpg] https://apt.kubernetes.io/ kubernetes-xenial main" | sudo tee /etc/apt/sources.list.d/kubernetes.list && \
sudo apt-get update && \
sudo apt-get install -y kubectl && \
mkdir -p ~/.HandyHost/aktData/kubespray && \
cd ~/.HandyHost/aktData/kubespray && \
git clone https://github.com/kubernetes-sigs/kubespray.git . && \
virtualenv --python=python3 venv && \
. venv/bin/activate && \
pip3 install -r requirements.txt


