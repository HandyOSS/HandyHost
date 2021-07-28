#!/bin/bash
#must be run as sudo
sudo apt-get update && \
sudo apt-get install --yes curl && \
sudo apt-get install --yes openssl && \
curl -fsSL get.docker.com -o ${HOME}/get-docker.sh && \
sudo sh ${HOME}/get-docker.sh && \
sudo groupadd docker && \
sudo gpasswd -a $USER docker && \
sudo modprobe ip6table_filter

